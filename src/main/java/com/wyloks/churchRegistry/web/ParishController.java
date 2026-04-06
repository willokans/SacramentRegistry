package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.ParishMarriageRequirementsPatchRequest;
import com.wyloks.churchRegistry.dto.ParishMarriageRequirementsResponse;
import com.wyloks.churchRegistry.dto.ParishRequest;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.ParishService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/parishes")
@RequiredArgsConstructor
public class ParishController {

    private final ParishService parishService;
    private final SacramentAuthorizationService authorizationService;

    @GetMapping("/{id}")
    public ResponseEntity<ParishResponse> getById(@PathVariable Long id) {
        authorizationService.requireParishAccess(id);
        return parishService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ParishResponse> create(@Valid @RequestBody ParishRequest request) {
        ParishResponse created = parishService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}/marriage-requirements")
    public ResponseEntity<ParishMarriageRequirementsResponse> getMarriageRequirements(@PathVariable Long id) {
        authorizationService.requireParishAccess(id);
        return parishService.getMarriageRequirements(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/marriage-requirements")
    public ResponseEntity<ParishMarriageRequirementsResponse> patchMarriageRequirements(
            @PathVariable Long id,
            @Valid @RequestBody ParishMarriageRequirementsPatchRequest body) {
        authorizationService.requireAdminRole();
        authorizationService.requireParishAccess(id);
        try {
            ParishMarriageRequirementsResponse updated =
                    parishService.updateMarriageRequirements(id, body.getRequireMarriageConfirmation());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
