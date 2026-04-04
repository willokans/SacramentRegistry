package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.ReplaceUserParishAccessRequest;
import com.wyloks.churchRegistry.dto.UserParishAccessResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.AppUserDetails;
import com.wyloks.churchRegistry.service.UserParishAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    @Override
    @Transactional(readOnly = true)
    public List<UserParishAccessResponse> listAllUsersWithParishAccess() {
        requireAdmin();
        return appUserRepository.findAllByOrderByUsernameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserParishAccessResponse> searchUsersWithParishAccess(String query, Pageable pageable) {
        requireAdmin();
        String normalizedQuery = query == null ? "" : query.trim();
        return appUserRepository.searchByUserMetadata(normalizedQuery, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public UserParishAccessResponse getUserParishAccess(Long userId) {
        requireAdmin();
        AppUser user = appUserRepository.findWithParishAccessesById(userId)
                .orElseThrow(() -> notFound("User not found: " + userId));
        return toResponse(user);
    }

    @Override
    @Transactional
    public UserParishAccessResponse replaceUserParishAccess(Long userId, ReplaceUserParishAccessRequest request) {
        requireAdmin();

        AppUser user = appUserRepository.findWithParishAccessesById(userId)
                .orElseThrow(() -> notFound("User not found: " + userId));

        Set<Long> requestedParishIds = normalizeParishIds(request);
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

    private void requireAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw forbidden("Authentication required");
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AppUserDetails userDetails)) {
            throw forbidden("Invalid authentication principal");
        }
        String role = normalizeRole(userDetails.getRole());
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw forbidden("Admin or Super Admin role required");
        }
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private UserParishAccessResponse toResponse(AppUser user) {
        Set<Long> parishAccessIds = user.getParishAccesses().stream()
                .map(Parish::getId)
                .collect(Collectors.toSet());

        return UserParishAccessResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .defaultParishId(user.getParish() != null ? user.getParish().getId() : null)
                .parishAccessIds(parishAccessIds)
                .build();
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
