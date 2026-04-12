package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.ConfirmationRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.HolyOrderRepository;
import com.wyloks.churchRegistry.repository.MarriageRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Final authorization guard for sacrament read/write operations.
 * Scope is derived from app_user_parish_access (assignment flow); parish_id is optional default.
 * Rows that exist but have no parish link cannot be accessed by non–{@code SUPER_ADMIN} users (deny-by-default).
 */
@Component
@RequiredArgsConstructor
public class SacramentAuthorizationService {

    private static final String NO_PARISH_READ = "Sacrament has no parish assignment; access denied";
    private static final String NO_PARISH_WRITE = "Sacrament has no parish assignment; write denied";

    private static final Set<String> WRITE_ROLES = Set.of(
            "ADMIN", "DIOCESE_ADMIN", "PRIEST", "PARISH_PRIEST", "PARISH_SECRETARY");

    private final BaptismRepository baptismRepository;
    private final FirstHolyCommunionRepository communionRepository;
    private final ConfirmationRepository confirmationRepository;
    private final MarriageRepository marriageRepository;
    private final HolyOrderRepository holyOrderRepository;
    private final ParishRepository parishRepository;

    public void requireParishAccess(Long parishId) {
        CurrentUser user = currentUser();
        if (user.isSuperAdmin()) {
            return;
        }
        if (user.parishIds().isEmpty()) {
            throw forbidden("No parish assigned. Contact admin.");
        }
        if (parishId == null || !user.parishIds().contains(parishId)) {
            throw forbidden("Cross-parish access denied");
        }
    }

    /**
     * Ensures the current user may call the diocesan dashboard for the given diocese.
     * {@code SUPER_ADMIN} may access any diocese; {@code DIOCESE_ADMIN} only if they have at least one assigned parish
     * in that diocese (expanded parish access from diocese assignment). Parish-scoped {@code ADMIN} is denied.
     */
    public void requireDioceseAccess(Long dioceseId) {
        CurrentUser user = currentUser();
        if (!user.canAccessDioceseDashboard()) {
            throw forbidden("Diocese access denied. Only SUPER_ADMIN and DIOCESE_ADMIN may access the diocesan dashboard.");
        }
        if (dioceseId == null) {
            throw forbidden("Diocese ID is required");
        }
        if (user.isSuperAdmin()) {
            return;
        }
        if (user.parishIds().isEmpty()) {
            throw forbidden("Diocese access denied. No parish assigned.");
        }
        if (parishRepository.findByIdInAndDioceseId(user.parishIds(), dioceseId).isEmpty()) {
            throw forbidden("Diocese access denied. No assigned parish in this diocese.");
        }
    }

    /**
     * Parish policy settings (e.g. marriage sacrament requirements): {@code ADMIN}, {@code DIOCESE_ADMIN}, or
     * {@code SUPER_ADMIN}, with parish scope enforced separately (e.g. {@link #requireParishAccess(Long)}).
     */
    public void requireAdminRole() {
        CurrentUser user = currentUser();
        if (!user.isParishAdminOrSuper()) {
            throw forbidden("Only ADMIN, DIOCESE_ADMIN, and SUPER_ADMIN may perform this action");
        }
    }

    public void requireWriteAccessForParish(Long parishId) {
        CurrentUser user = currentUser();
        if (!WRITE_ROLES.contains(user.role())) {
            throw forbidden("Insufficient role for sacrament write access");
        }
        if (user.isSuperAdmin()) {
            return;
        }
        if (user.parishIds().isEmpty()) {
            throw forbidden("No parish assigned. Contact admin.");
        }
        if (parishId == null || !user.parishIds().contains(parishId)) {
            throw forbidden("Cross-parish write denied");
        }
    }

    public Optional<Long> findBaptismParishId(Long baptismId) {
        return baptismRepository.findParishIdById(baptismId);
    }

    public Optional<Long> findCommunionParishId(Long communionId) {
        return communionRepository.findParishIdById(communionId);
    }

    public Optional<Long> findCommunionParishIdByBaptismId(Long baptismId) {
        return communionRepository.findParishIdByBaptismId(baptismId);
    }

    public Optional<Long> findConfirmationParishId(Long confirmationId) {
        return confirmationRepository.findParishIdById(confirmationId);
    }

    public Optional<Long> findConfirmationParishIdByCommunionId(Long communionId) {
        return confirmationRepository.findParishIdByFirstHolyCommunionId(communionId);
    }

    public Optional<Long> findMarriageParishId(Long marriageId) {
        return marriageRepository.findParishIdById(marriageId);
    }

    public Optional<Long> findMarriageParishIdByConfirmationId(Long confirmationId) {
        return marriageRepository.findParishIdByConfirmationId(confirmationId);
    }

    public Optional<Long> findHolyOrderParishId(Long holyOrderId) {
        return holyOrderRepository.findParishIdById(holyOrderId);
    }

    public Optional<Long> findBaptismParishIdForCommunionRequest(Long baptismId) {
        return baptismRepository.findParishIdById(baptismId);
    }

    /**
     * Read access for a baptism row. {@code false} means no row — caller should respond with 404.
     */
    public boolean requireReadAccessForBaptism(Long baptismId) {
        if (!baptismRepository.existsById(baptismId)) {
            return false;
        }
        enforceReadAccessForResolvedParish(baptismRepository.findParishIdById(baptismId));
        return true;
    }

    /**
     * Write access for a baptism row. {@code false} means no row — caller should respond with 404.
     */
    public boolean requireWriteAccessForBaptism(Long baptismId) {
        if (!baptismRepository.existsById(baptismId)) {
            return false;
        }
        enforceWriteAccessForResolvedParish(baptismRepository.findParishIdById(baptismId));
        return true;
    }

    public boolean requireReadAccessForCommunion(Long communionId) {
        if (!communionRepository.existsById(communionId)) {
            return false;
        }
        enforceReadAccessForResolvedParish(communionRepository.findParishIdById(communionId));
        return true;
    }

    public boolean requireWriteAccessForCommunion(Long communionId) {
        if (!communionRepository.existsById(communionId)) {
            return false;
        }
        enforceWriteAccessForResolvedParish(communionRepository.findParishIdById(communionId));
        return true;
    }

    /**
     * Read communion by baptism id (at most one). {@code false} if no communion for that baptism.
     */
    public boolean requireReadAccessForCommunionByBaptismId(Long baptismId) {
        return communionRepository.findByBaptismId(baptismId)
                .map(c -> {
                    enforceReadAccessForResolvedParish(communionRepository.findParishIdById(c.getId()));
                    return true;
                })
                .orElse(false);
    }

    public boolean requireReadAccessForConfirmation(Long confirmationId) {
        if (!confirmationRepository.existsById(confirmationId)) {
            return false;
        }
        enforceReadAccessForResolvedParish(confirmationRepository.findParishIdById(confirmationId));
        return true;
    }

    public boolean requireWriteAccessForConfirmation(Long confirmationId) {
        if (!confirmationRepository.existsById(confirmationId)) {
            return false;
        }
        enforceWriteAccessForResolvedParish(confirmationRepository.findParishIdById(confirmationId));
        return true;
    }

    public boolean requireReadAccessForConfirmationByCommunionId(Long communionId) {
        return confirmationRepository.findByFirstHolyCommunionId(communionId)
                .map(c -> {
                    enforceReadAccessForResolvedParish(confirmationRepository.findParishIdById(c.getId()));
                    return true;
                })
                .orElse(false);
    }

    public boolean requireReadAccessForMarriage(Long marriageId) {
        if (!marriageRepository.existsById(marriageId)) {
            return false;
        }
        enforceReadAccessForResolvedParish(marriageRepository.findParishIdById(marriageId));
        return true;
    }

    public boolean requireWriteAccessForMarriage(Long marriageId) {
        if (!marriageRepository.existsById(marriageId)) {
            return false;
        }
        enforceWriteAccessForResolvedParish(marriageRepository.findParishIdById(marriageId));
        return true;
    }

    public boolean requireReadAccessForMarriageByConfirmationId(Long confirmationId) {
        return marriageRepository.findByConfirmationId(confirmationId)
                .map(m -> {
                    enforceReadAccessForResolvedParish(marriageRepository.findParishIdById(m.getId()));
                    return true;
                })
                .orElse(false);
    }

    public boolean requireReadAccessForMarriageByBaptismId(Long baptismId) {
        return marriageRepository.findByBaptismId(baptismId)
                .map(m -> {
                    enforceReadAccessForResolvedParish(marriageRepository.findParishIdById(m.getId()));
                    return true;
                })
                .orElse(false);
    }

    public boolean requireReadAccessForHolyOrder(Long holyOrderId) {
        if (!holyOrderRepository.existsById(holyOrderId)) {
            return false;
        }
        enforceReadAccessForResolvedParish(holyOrderRepository.findParishIdById(holyOrderId));
        return true;
    }

    /**
     * For POST /communions: baptism must exist with a parish (or {@code SUPER_ADMIN} may proceed only if parish is set).
     */
    public long requireBaptismForCommunionCreate(Long baptismId) {
        if (!baptismRepository.existsById(baptismId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Baptism not found");
        }
        Optional<Long> parishId = baptismRepository.findParishIdById(baptismId);
        enforceWriteAccessForResolvedParish(parishId);
        return parishId.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Baptism has no parish"));
    }

    /**
     * For POST /marriages: confirmation must exist; parish comes from confirmation (marriage row may not exist yet).
     */
    public long requireConfirmationForMarriageCreate(Long confirmationId) {
        if (!confirmationRepository.existsById(confirmationId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confirmation not found");
        }
        Optional<Long> parishId = confirmationRepository.findParishIdById(confirmationId);
        enforceWriteAccessForResolvedParish(parishId);
        return parishId.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Confirmation has no parish"));
    }

    /**
     * Validates write access using an existing confirmation's parish chain (e.g. marriage-with-parties when linking parties).
     */
    public long requireWriteAccessForExistingConfirmation(Long confirmationId) {
        if (!confirmationRepository.existsById(confirmationId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confirmation not found");
        }
        Optional<Long> parishId = confirmationRepository.findParishIdById(confirmationId);
        enforceWriteAccessForResolvedParish(parishId);
        return parishId.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Confirmation has no parish"));
    }

    /**
     * For POST /confirmations: communion must exist and have a parish chain resolvable for write.
     */
    public long requireCommunionForConfirmationCreate(Long communionId) {
        if (!communionRepository.existsById(communionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Communion not found");
        }
        Optional<Long> parishId = communionRepository.findParishIdById(communionId);
        enforceWriteAccessForResolvedParish(parishId);
        return parishId.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Communion not found or has no parish"));
    }

    private void enforceReadAccessForResolvedParish(Optional<Long> parishIdOpt) {
        CurrentUser user = currentUser();
        if (user.isSuperAdmin()) {
            return;
        }
        if (parishIdOpt == null || parishIdOpt.isEmpty()) {
            throw forbidden(NO_PARISH_READ);
        }
        requireParishAccess(parishIdOpt.get());
    }

    private void enforceWriteAccessForResolvedParish(Optional<Long> parishIdOpt) {
        CurrentUser user = currentUser();
        if (user.isSuperAdmin()) {
            return;
        }
        if (parishIdOpt == null || parishIdOpt.isEmpty()) {
            throw forbidden(NO_PARISH_WRITE);
        }
        requireWriteAccessForParish(parishIdOpt.get());
    }

    private CurrentUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw forbidden("Authentication required");
        }

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AppUserDetails userDetails)) {
            throw forbidden("Invalid authentication principal");
        }

        String role = normalizeRole(userDetails.getRole());
        if (role == null) {
            throw forbidden("Role is required");
        }

        return new CurrentUser(role, userDetails.getParishAccessIds());
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private record CurrentUser(String role, Set<Long> parishIds) {
        boolean isSuperAdmin() {
            return "SUPER_ADMIN".equals(role);
        }

        boolean canAccessDioceseDashboard() {
            return isSuperAdmin() || "DIOCESE_ADMIN".equals(role);
        }

        boolean isParishAdminOrSuper() {
            return "ADMIN".equals(role) || "DIOCESE_ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        }
    }
}
