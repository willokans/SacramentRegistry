package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.BaptismRequest;
import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionRequest;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionResponse;
import com.wyloks.churchRegistry.dto.NoteUpdateRequest;
import com.wyloks.churchRegistry.dto.SacramentNoteResponse;
import com.wyloks.churchRegistry.entity.SacramentAuditLog.SacramentType;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.BaptismService;
import com.wyloks.churchRegistry.service.FirstHolyCommunionService;
import com.wyloks.churchRegistry.service.RemoteFileService;
import com.wyloks.churchRegistry.service.SacramentAuditService;
import com.wyloks.churchRegistry.util.NameUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FirstHolyCommunionController {

    private final FirstHolyCommunionService communionService;
    private final BaptismService baptismService;
    private final RemoteFileService remoteFileService;
    private final SacramentAuthorizationService authorizationService;
    private final SacramentAuditService auditService;

    private static final String COMMUNION_CERTIFICATES_BUCKET = "communion-certificates";
    private static final String BAPTISM_CERTIFICATES_BUCKET = "baptism-certificates";
    private static final long MAX_CERTIFICATE_SIZE = 2L * 1024 * 1024;

    @GetMapping("/parishes/{parishId}/communions")
    public Page<FirstHolyCommunionResponse> getByParish(
            @PathVariable Long parishId,
            @PageableDefault(size = 50) Pageable pageable) {
        authorizationService.requireParishAccess(parishId);
        Page<FirstHolyCommunionResponse> result = communionService.findByParishId(parishId, pageable);
        auditService.logReadList(SacramentType.COMMUNION, parishId);
        return result;
    }

    @GetMapping("/communions/{id}")
    public ResponseEntity<FirstHolyCommunionResponse> getById(@PathVariable Long id) {
        if (!authorizationService.requireReadAccessForCommunion(id)) {
            return ResponseEntity.notFound().build();
        }
        return communionService.findById(id)
                .map(r -> {
                    Long parishId = authorizationService.findCommunionParishId(id).orElse(null);
                    auditService.logRead(SacramentType.COMMUNION, id, parishId);
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/baptisms/{baptismId}/communions")
    public ResponseEntity<FirstHolyCommunionResponse> getByBaptismId(@PathVariable Long baptismId) {
        if (!authorizationService.requireReadAccessForCommunionByBaptismId(baptismId)) {
            return ResponseEntity.notFound().build();
        }
        return communionService.findByBaptismId(baptismId)
                .map(r -> {
                    Long parishId = authorizationService.findBaptismParishIdForCommunionRequest(baptismId).orElse(null);
                    auditService.logRead(SacramentType.COMMUNION, r.getId(), parishId);
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/communions", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FirstHolyCommunionResponse> create(@Valid @RequestBody FirstHolyCommunionRequest request) {
        long parishId = authorizationService.requireBaptismForCommunionCreate(request.getBaptismId());
        FirstHolyCommunionResponse created = communionService.create(request);
        auditService.logCreate(SacramentType.COMMUNION, created.getId(), parishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/communions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FirstHolyCommunionResponse> createWithCertificate(
            @RequestParam(value = "communionSource", required = false) String communionSource,
            @RequestParam(value = "baptismSource", required = false) String baptismSource,
            @RequestParam(value = "parishId", required = false) Long parishId,
            @RequestParam(value = "baptismId", required = false) Long baptismId,
            @RequestParam("communionDate") String communionDate,
            @RequestParam("officiatingPriest") String officiatingPriest,
            @RequestParam("parish") String parish,
            @RequestParam(value = "communionCertificate", required = false) MultipartFile communionCertificate,
            @RequestParam(value = "certificate", required = false) MultipartFile baptismCertificate,
            @RequestParam(value = "baptismCertificatePath", required = false) String baptismCertificatePath,
            @RequestParam(value = "externalBaptismName", required = false) String externalBaptismName,
            @RequestParam(value = "externalSurname", required = false) String externalSurname,
            @RequestParam(value = "externalOtherNames", required = false) String externalOtherNames,
            @RequestParam(value = "externalGender", required = false) String externalGender,
            @RequestParam(value = "externalFathersName", required = false) String externalFathersName,
            @RequestParam(value = "externalMothersName", required = false) String externalMothersName,
            @RequestParam(value = "externalBaptisedChurchAddress", required = false) String externalBaptisedChurchAddress
    ) {
        if (communionDate == null || communionDate.isBlank() || officiatingPriest == null || officiatingPriest.isBlank()
                || parish == null || parish.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Communion date, officiating priest, and parish are required.");
        }

        if ("external".equals(communionSource)) {
            return createCommunionWithCommunionCertificate(baptismId, communionDate, officiatingPriest, parish,
                    communionCertificate, baptismCertificatePath);
        }
        if ("external".equals(baptismSource)) {
            return createCommunionWithExternalBaptism(parishId, communionDate, officiatingPriest, parish,
                    baptismCertificate, externalBaptismName, externalSurname, externalOtherNames, externalGender,
                    externalFathersName, externalMothersName, externalBaptisedChurchAddress);
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Either communionSource=external or baptismSource=external is required for multipart upload.");
    }

    private ResponseEntity<FirstHolyCommunionResponse> createCommunionWithCommunionCertificate(
            Long baptismId, String communionDate, String officiatingPriest, String parish,
            MultipartFile communionCertificate, String baptismCertificatePath) {
        if (baptismId == null || baptismId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Baptism is required for Communion from another church.");
        }
        if (communionCertificate == null || communionCertificate.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upload a Holy Communion certificate when Communion was in another church.");
        }
        if (communionCertificate.getSize() > MAX_CERTIFICATE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Certificate file is too large. Maximum size is 2 MB.");
        }
        long parishId = authorizationService.requireBaptismForCommunionCreate(baptismId);

        String safeName = System.currentTimeMillis() + "-" + (communionCertificate.getOriginalFilename() != null
                ? communionCertificate.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_") : "file");
        String contentType = communionCertificate.getContentType();
        if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";
        String certPath;
        try {
            certPath = remoteFileService.upload(COMMUNION_CERTIFICATES_BUCKET, safeName,
                    communionCertificate.getBytes(), contentType);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to upload certificate: " + e.getMessage());
        }
        String storedPath = COMMUNION_CERTIFICATES_BUCKET + "/" + certPath;

        FirstHolyCommunionRequest request = FirstHolyCommunionRequest.builder()
                .baptismId(baptismId)
                .communionDate(LocalDate.parse(communionDate.trim()))
                .officiatingPriest(NameUtils.capitalizeNameOrEmpty(officiatingPriest))
                .parish(NameUtils.capitalizeNameOrEmpty(parish))
                .communionCertificatePath(storedPath)
                .baptismCertificatePath(baptismCertificatePath != null && !baptismCertificatePath.isBlank()
                        ? baptismCertificatePath.trim() : null)
                .build();
        FirstHolyCommunionResponse created = communionService.create(request);
        auditService.logCreate(SacramentType.COMMUNION, created.getId(), parishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    private ResponseEntity<FirstHolyCommunionResponse> createCommunionWithExternalBaptism(
            Long parishId, String communionDate, String officiatingPriest, String parish,
            MultipartFile baptismCertificate, String externalBaptismName, String externalSurname, String externalOtherNames,
            String externalGender, String externalFathersName, String externalMothersName, String externalBaptisedChurchAddress) {
        boolean hasCertificate = baptismCertificate != null && !baptismCertificate.isEmpty();
        if (hasCertificate && baptismCertificate.getSize() > MAX_CERTIFICATE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Certificate file is too large. Maximum size is 2 MB.");
        }
        if (parishId == null || parishId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parish is required for external baptism.");
        }
        if (externalBaptismName == null || externalBaptismName.isBlank() || externalSurname == null || externalSurname.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Baptism name and surname are required for external baptism.");
        }
        authorizationService.requireWriteAccessForParish(parishId);

        String baptismCertStoredPath = null;
        if (hasCertificate) {
            String safeName = System.currentTimeMillis() + "-" + (baptismCertificate.getOriginalFilename() != null
                    ? baptismCertificate.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_") : "file");
            String contentType = baptismCertificate.getContentType();
            if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";
            String certPath;
            try {
                certPath = remoteFileService.upload(BAPTISM_CERTIFICATES_BUCKET, safeName,
                        baptismCertificate.getBytes(), contentType);
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to upload certificate: " + e.getMessage());
            }
            baptismCertStoredPath = BAPTISM_CERTIFICATES_BUCKET + "/" + certPath;
        }

        String placeOfBaptism = externalBaptisedChurchAddress != null && !externalBaptisedChurchAddress.isBlank()
                ? externalBaptisedChurchAddress.trim() : "See Certificate";
        BaptismRequest baptismRequest = BaptismRequest.builder()
                .baptismName(NameUtils.capitalizeNameOrEmpty(externalBaptismName))
                .surname(NameUtils.capitalizeNameOrEmpty(externalSurname))
                .otherNames(NameUtils.capitalizeNameOrEmpty(externalOtherNames))
                .gender(externalGender != null && !externalGender.isBlank() ? externalGender.trim() : "MALE")
                .dateOfBirth(LocalDate.now())
                .fathersName(NameUtils.capitalizeNameOrEmpty(externalFathersName))
                .mothersName(NameUtils.capitalizeNameOrEmpty(externalMothersName))
                .sponsorNames("See Certificate")
                .officiatingPriest("See Certificate")
                .parishId(parishId)
                .parishAddress(externalBaptisedChurchAddress != null ? externalBaptisedChurchAddress.trim() : null)
                .externalCertificatePath(baptismCertStoredPath)
                .externalCertificateIssuingParish(parish)
                .placeOfBirth("See Certificate")
                .placeOfBaptism(placeOfBaptism)
                .dateOfBaptism(LocalDate.now())
                .build();
        BaptismResponse baptism = baptismService.create(parishId, baptismRequest);

        FirstHolyCommunionRequest communionRequest = FirstHolyCommunionRequest.builder()
                .baptismId(baptism.getId())
                .communionDate(LocalDate.parse(communionDate.trim()))
                .officiatingPriest(NameUtils.capitalizeNameOrEmpty(officiatingPriest))
                .parish(NameUtils.capitalizeNameOrEmpty(parish))
                .baptismCertificatePath(baptismCertStoredPath)
                .build();
        FirstHolyCommunionResponse created = communionService.create(communionRequest);
        auditService.logCreate(SacramentType.COMMUNION, created.getId(), parishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/communions/{id}")
    public ResponseEntity<FirstHolyCommunionResponse> updateNote(@PathVariable Long id, @RequestBody NoteUpdateRequest request) {
        if (!authorizationService.requireWriteAccessForCommunion(id)) {
            return ResponseEntity.notFound().build();
        }
        FirstHolyCommunionResponse updated = communionService.updateNote(id, request != null ? request.getNote() : null);
        Long parishId = authorizationService.findCommunionParishId(id).orElse(null);
        auditService.logUpdate(SacramentType.COMMUNION, id, parishId, "note");
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/communions/{id}/notes")
    public List<SacramentNoteResponse> getNoteHistory(@PathVariable Long id) {
        if (!authorizationService.requireReadAccessForCommunion(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "First Holy Communion not found");
        }
        List<SacramentNoteResponse> result = communionService.getNoteHistory(id);
        Long parishId = authorizationService.findCommunionParishId(id).orElse(null);
        auditService.logRead(SacramentType.COMMUNION, id, parishId);
        return result;
    }
}
