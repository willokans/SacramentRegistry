package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.HolyOrderRequest;
import com.wyloks.churchRegistry.dto.HolyOrderResponse;
import com.wyloks.churchRegistry.entity.SacramentAuditLog.SacramentType;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.HolyOrderService;
import com.wyloks.churchRegistry.service.SacramentAuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HolyOrderController {

    private final HolyOrderService holyOrderService;
    private final SacramentAuthorizationService authorizationService;
    private final SacramentAuditService auditService;

    @GetMapping("/parishes/{parishId}/holy-orders")
    public Page<HolyOrderResponse> getByParish(
            @PathVariable Long parishId,
            @PageableDefault(size = 50) Pageable pageable) {
        authorizationService.requireParishAccess(parishId);
        Page<HolyOrderResponse> result = holyOrderService.findByParishId(parishId, pageable);
        auditService.logReadList(SacramentType.HOLY_ORDER, parishId);
        return result;
    }

    @GetMapping("/holy-orders/{id}")
    public ResponseEntity<HolyOrderResponse> getById(@PathVariable Long id) {
        if (!authorizationService.requireReadAccessForHolyOrder(id)) {
            return ResponseEntity.notFound().build();
        }
        return holyOrderService.findById(id)
                .map(r -> {
                    Long parishId = authorizationService.findHolyOrderParishId(id).orElse(r.getParishId());
                    auditService.logRead(SacramentType.HOLY_ORDER, id, parishId);
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/confirmations/{confirmationId}/holy-order")
    public ResponseEntity<HolyOrderResponse> getByConfirmationId(@PathVariable Long confirmationId) {
        if (!authorizationService.requireReadAccessForConfirmation(confirmationId)) {
            return ResponseEntity.notFound().build();
        }
        return holyOrderService.findByConfirmationId(confirmationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/holy-orders")
    public ResponseEntity<HolyOrderResponse> create(@Valid @RequestBody HolyOrderRequest request) {
        long confirmationParishId = authorizationService.requireWriteAccessForExistingConfirmation(request.getConfirmationId());
        if (request.getParishId() != null && !request.getParishId().equals(confirmationParishId)) {
            authorizationService.requireWriteAccessForParish(request.getParishId());
        }
        HolyOrderResponse created = holyOrderService.create(request);
        Long auditParishId = created.getParishId() != null ? created.getParishId() : confirmationParishId;
        auditService.logCreate(SacramentType.HOLY_ORDER, created.getId(), auditParishId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
