package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.ReplaceUserParishAccessRequest;
import com.wyloks.churchRegistry.dto.UserParishAccessResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.security.ParishAccessPolicy;
import com.wyloks.churchRegistry.service.DioceseAdminParishSyncService;
import com.wyloks.churchRegistry.service.UserParishAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserParishAccessServiceImpl implements UserParishAccessService {

    private final AppUserRepository appUserRepository;
    private final ParishRepository parishRepository;
    private final CurrentUserAccessService currentUserAccessService;
    private final DioceseAdminParishSyncService dioceseAdminParishSyncService;

    @Override
    @Transactional(readOnly = true)
    public List<UserParishAccessResponse> listAllUsersWithParishAccess() {
        CurrentUserAccessService.CurrentUserAccess actor = requireAdmin();
        if (actor.isSuperAdmin()) {
            return appUserRepository.findAllByOrderByUsernameAsc().stream()
                    .map(this::toResponse)
                    .toList();
        }
        if (actor.parishIds().isEmpty()) {
            return List.of();
        }
        return appUserRepository.findWithParishOverlapOrderByUsernameAsc(actor.parishIds()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserParishAccessResponse> searchUsersWithParishAccess(String query, Pageable pageable) {
        CurrentUserAccessService.CurrentUserAccess actor = requireAdmin();
        if (actor.isSuperAdmin()) {
            String normalizedQuery = query == null ? "" : query.trim();
            return appUserRepository.searchByUserMetadata(normalizedQuery, pageable)
                    .map(this::toResponse);
        }
        if (actor.parishIds().isEmpty()) {
            return Page.empty(pageable);
        }
        String normalizedQuery = query == null ? "" : query.trim();
        return appUserRepository.searchByUserMetadataWithParishOverlap(actor.parishIds(), normalizedQuery, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public UserParishAccessResponse getUserParishAccess(Long userId) {
        CurrentUserAccessService.CurrentUserAccess actor = requireAdmin();
        AppUser user = appUserRepository.findWithParishAccessesById(userId)
                .orElseThrow(() -> notFound("User not found: " + userId));
        requireMutualParishVisibility(actor, user);
        return toResponse(user);
    }

    @Override
    @Transactional
    public UserParishAccessResponse replaceUserParishAccess(Long userId, ReplaceUserParishAccessRequest request) {
        CurrentUserAccessService.CurrentUserAccess actor = requireAdmin();

        AppUser user = appUserRepository.findWithParishAccessesById(userId)
                .orElseThrow(() -> notFound("User not found: " + userId));
        requireMutualParishVisibility(actor, user);

        String targetRole = normalizeRole(user.getRole());
        if ("DIOCESE_ADMIN".equals(targetRole)) {
            if (!actor.isSuperAdmin()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Super Admin role required to modify diocese administrator assignments");
            }
            Set<Long> dioceseIds = normalizeDioceseIds(request);
            if (dioceseIds.isEmpty()) {
                throw new IllegalArgumentException("dioceseIds is required for DIOCESE_ADMIN users");
            }
            dioceseAdminParishSyncService.assignDiocesesAndSyncParishes(user, dioceseIds);

            Long requestedDefaultParishId = request.getDefaultParishId();
            Set<Long> derivedParishIds = user.getParishAccesses().stream()
                    .map(Parish::getId)
                    .collect(Collectors.toSet());
            if (requestedDefaultParishId != null && !derivedParishIds.contains(requestedDefaultParishId)) {
                throw new IllegalArgumentException("defaultParishId must be one of the parishes in assigned dioceses");
            }
            Map<Long, Parish> parishById = user.getParishAccesses().stream()
                    .collect(Collectors.toMap(Parish::getId, Function.identity()));
            Parish defaultParish = resolveDefaultParish(user, requestedDefaultParishId, derivedParishIds, parishById);
            user.setParish(defaultParish);
            return toResponse(appUserRepository.save(user));
        }

        dioceseAdminParishSyncService.clearDioceseAccess(user);

        Set<Long> requestedParishIds = normalizeParishIds(request);
        if (!actor.isSuperAdmin()) {
            if (!actor.parishIds().containsAll(requestedParishIds)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot assign parishes outside your scope");
            }
        }

        List<Parish> parishes = requestedParishIds.isEmpty()
                ? List.of()
                : parishRepository.findByIdIn(requestedParishIds);

        if (parishes.size() != requestedParishIds.size()) {
            throw new IllegalArgumentException("One or more parishIds do not exist");
        }

        Map<Long, Parish> parishById = parishes.stream()
                .collect(Collectors.toMap(Parish::getId, Function.identity()));

        Long requestedDefaultParishId = request.getDefaultParishId();
        if (requestedDefaultParishId != null && !requestedParishIds.contains(requestedDefaultParishId)) {
            throw new IllegalArgumentException("defaultParishId must be included in parishIds");
        }

        Set<Parish> newParishAccesses = new HashSet<>(parishes);
        user.getParishAccesses().clear();
        user.getParishAccesses().addAll(newParishAccesses);

        Parish defaultParish = resolveDefaultParish(user, requestedDefaultParishId, requestedParishIds, parishById);
        user.setParish(defaultParish);

        return toResponse(appUserRepository.save(user));
    }

    private void requireMutualParishVisibility(CurrentUserAccessService.CurrentUserAccess actor, AppUser targetUser) {
        if (actor.isSuperAdmin()) {
            return;
        }
        if (!ParishAccessPolicy.sharesParishWithActor(actor.parishIds(), targetUser)) {
            throw notFound("User not found: " + targetUser.getId());
        }
    }

    private CurrentUserAccessService.CurrentUserAccess requireAdmin() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isAdmin()) {
            throw forbidden("Administrator access required (parish admin, diocese admin, or super admin)");
        }
        return currentUser;
    }

    private Set<Long> normalizeParishIds(ReplaceUserParishAccessRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (request.getParishIds() == null) {
            return Collections.emptySet();
        }
        if (request.getParishIds().stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("parishIds must contain only positive IDs");
        }
        return new HashSet<>(request.getParishIds());
    }

    private Set<Long> normalizeDioceseIds(ReplaceUserParishAccessRequest request) {
        if (request.getDioceseIds() == null) {
            return Collections.emptySet();
        }
        if (request.getDioceseIds().stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("dioceseIds must contain only positive IDs");
        }
        return new HashSet<>(request.getDioceseIds());
    }

    private static String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private Parish resolveDefaultParish(
            AppUser user,
            Long requestedDefaultParishId,
            Set<Long> requestedParishIds,
            Map<Long, Parish> parishById
    ) {
        if (requestedDefaultParishId != null) {
            return parishById.get(requestedDefaultParishId);
        }

        Long currentDefaultParishId = user.getParish() != null ? user.getParish().getId() : null;
        if (currentDefaultParishId != null && requestedParishIds.contains(currentDefaultParishId)) {
            return parishById.get(currentDefaultParishId);
        }

        if (requestedParishIds.size() == 1) {
            return parishById.get(requestedParishIds.iterator().next());
        }

        return null;
    }

    private UserParishAccessResponse toResponse(AppUser user) {
        Set<Long> parishAccessIds = user.getParishAccesses().stream()
                .map(Parish::getId)
                .collect(Collectors.toSet());
        Set<Long> dioceseAccessIds = user.getDioceseAccesses().stream()
                .map(Diocese::getId)
                .collect(Collectors.toSet());

        return UserParishAccessResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .defaultParishId(user.getParish() != null ? user.getParish().getId() : null)
                .parishAccessIds(parishAccessIds)
                .dioceseAccessIds(dioceseAccessIds)
                .build();
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
