package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.MarriageRequest;
import com.wyloks.churchRegistry.dto.CreateMarriageWithPartiesRequest;
import com.wyloks.churchRegistry.dto.MarriageResponse;
import com.wyloks.churchRegistry.dto.NoteUpdateRequest;
import com.wyloks.churchRegistry.dto.SacramentNoteResponse;
import com.wyloks.churchRegistry.entity.SacramentAuditLog.SacramentType;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.service.MarriageService;
import com.wyloks.churchRegistry.service.ParishService;
import com.wyloks.churchRegistry.service.SacramentAuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MarriageController {

    private final MarriageService marriageService;
    private final ParishService parishService;
    private final SacramentAuthorizationService authorizationService;
    private final SacramentAuditService auditService;

    @GetMapping("/parishes/{parishId}/marriages")
    public Page<MarriageResponse> getByParish(
            @PathVariable Long parishId,
            @PageableDefault(size = 50) Pageable pageable) {
        authorizationService.requireParishAccess(parishId);
        Page<MarriageResponse> result = marriageService.findByParishId(parishId, pageable);
        auditService.logReadList(SacramentType.MARRIAGE, parishId);
        return result;
    }

    @GetMapping("/marriages/{id}")
    public ResponseEntity<MarriageResponse> getById(@PathVariable Long id) {
        if (!authorizationService.requireReadAccessForMarriage(id)) {
            return ResponseEntity.notFound().build();
        }
        return marriageService.findById(id)
                .map(r -> {
                    Long parishId = authorizationService.findMarriageParishId(id).orElse(null);
                    auditService.logRead(SacramentType.MARRIAGE, id, parishId);
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/confirmations/{confirmationId}/marriage")
    public ResponseEntity<MarriageResponse> getByConfirmationId(@PathVariable Long confirmationId) {
        if (!authorizationService.requireReadAccessForMarriageByConfirmationId(confirmationId)) {
            return ResponseEntity.notFound().build();
        }
        return marriageService.findByConfirmationId(confirmationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/baptisms/{baptismId}/marriage")
    public ResponseEntity<MarriageResponse> getByBaptismId(@PathVariable Long baptismId) {
        if (!authorizationService.requireReadAccessForMarriageByBaptismId(baptismId)) {
            return ResponseEntity.notFound().build();
        }
        return marriageService.findByBaptismId(baptismId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/marriages")
    public ResponseEntity<MarriageResponse> create(@Valid @RequestBody MarriageRequest request) {
        long parishId = authorizationService.requireConfirmationForMarriageCreate(request.getConfirmationId());
        MarriageResponse created = marriageService.create(request);
        auditService.logCreate(SacramentType.MARRIAGE, created.getId(), parishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/marriages/with-parties")
    public ResponseEntity<MarriageResponse> createWithParties(@Valid @RequestBody CreateMarriageWithPartiesRequest request) {
        authorizeCreateMarriageWithParties(request);
        MarriageResponse created = marriageService.createWithParties(request);
        Long parishId = request.getMarriage().getParishId();
        auditService.logCreate(SacramentType.MARRIAGE, created.getId(), parishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    private void authorizeCreateMarriageWithParties(CreateMarriageWithPartiesRequest request) {
        if (request.getMarriage() == null || request.getMarriage().getParishId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "marriage.parishId is required");
        }
        if (request.getGroom() == null || request.getBride() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "groom and bride are required");
        }
        Long parishId = request.getMarriage().getParishId();
        ParishResponse parish = parishService.findById(parishId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parish not found: " + parishId));
        boolean requireConf = parish.isRequireMarriageConfirmation();
        Integer groomConf = request.getGroom().getConfirmationId();
        Integer brideConf = request.getBride().getConfirmationId();
        String groomCertPath = request.getGroom().getConfirmationCertificatePath();
        String brideCertPath = request.getBride().getConfirmationCertificatePath();

        if (requireConf) {
            if (!partyDocumentsConfirmation(groomConf, groomCertPath) || !partyDocumentsConfirmation(brideConf, brideCertPath)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "When this parish requires Confirmation, both parties must document Confirmation (in-parish record or certificate).");
            }
            if (groomConf == null && brideConf == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "At least one party must have an in-parish Confirmation record linked for the marriage register.");
            }
            if (groomConf != null) {
                long p = authorizationService.requireWriteAccessForExistingConfirmation(groomConf.longValue());
                if (p != parishId) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Groom Confirmation parish does not match marriage parish");
                }
            }
            if (brideConf != null) {
                long p = authorizationService.requireWriteAccessForExistingConfirmation(brideConf.longValue());
                if (p != parishId) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Bride Confirmation parish does not match marriage parish");
                }
            }
            authorizationService.requireWriteAccessForParish(parishId);
            return;
        }

        Long confirmationId = null;
        if (groomConf != null) {
            confirmationId = groomConf.longValue();
        } else if (brideConf != null) {
            confirmationId = brideConf.longValue();
        }
        if (confirmationId != null) {
            long parishFromConf = authorizationService.requireWriteAccessForExistingConfirmation(confirmationId);
            if (parishFromConf != parishId) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Confirmation parish does not match marriage parish");
            }
            authorizationService.requireWriteAccessForParish(parishFromConf);
        } else {
            authorizationService.requireWriteAccessForParish(parishId);
        }
    }

    private static boolean partyDocumentsConfirmation(Integer confirmationId, String certificatePath) {
        if (confirmationId != null) {
            return true;
        }
        return certificatePath != null && !certificatePath.isBlank();
    }

    @PatchMapping("/marriages/{id}")
    public ResponseEntity<MarriageResponse> updateNote(@PathVariable Long id, @RequestBody NoteUpdateRequest request) {
        if (!authorizationService.requireWriteAccessForMarriage(id)) {
            return ResponseEntity.notFound().build();
        }
        MarriageResponse updated = marriageService.updateNote(id, request != null ? request.getNote() : null);
        Long parishId = authorizationService.findMarriageParishId(id).orElse(null);
        auditService.logUpdate(SacramentType.MARRIAGE, id, parishId, "note");
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/marriages/{id}/notes")
    public List<SacramentNoteResponse> getNoteHistory(@PathVariable Long id) {
        if (!authorizationService.requireReadAccessForMarriage(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Marriage not found");
        }
        List<SacramentNoteResponse> result = marriageService.getNoteHistory(id);
        Long parishId = authorizationService.findMarriageParishId(id).orElse(null);
        auditService.logRead(SacramentType.MARRIAGE, id, parishId);
        return result;
    }
}
