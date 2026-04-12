package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.CreateUserRequest;
import com.wyloks.churchRegistry.dto.UserParishAccessResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.AppUserDetails;
import com.wyloks.churchRegistry.service.AdminUserService;
import com.wyloks.churchRegistry.service.DioceseAdminParishSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
public class AdminUserServiceImpl implements AdminUserService {

    private static final Set<String> ALLOWED_ROLES = Set.of(
            "SUPER_ADMIN", "ADMIN", "DIOCESE_ADMIN", "PRIEST", "PARISH_PRIEST", "PARISH_SECRETARY", "PARISH_VIEWER"
    );

    private final AppUserRepository appUserRepository;
    private final ParishRepository parishRepository;
    private final PasswordEncoder passwordEncoder;
    private final DioceseAdminParishSyncService dioceseAdminParishSyncService;

    @Override
    @Transactional
    public UserParishAccessResponse createUser(CreateUserRequest request) {
        requireSuperAdmin();

        String role = normalizeRole(request.getRole());
        if (!ALLOWED_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid role. Allowed: " + String.join(", ", ALLOWED_ROLES));
        }

        if (appUserRepository.existsByUsername(request.getUsername().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A user with this username already exists. Please choose a different username.");
        }

        String email = request.getEmail();
        if (email != null && !email.isBlank()) {
            if (appUserRepository.existsByEmail(email.trim())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A user with this email address already exists. Please use a different email.");
            }
        }

        String firstName = request.getFirstName().trim();
        String lastName = request.getLastName().trim();
        if (appUserRepository.existsByFirstNameIgnoreCaseAndLastNameIgnoreCase(firstName, lastName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A user with this name (first name and last name) already exists. Please use a different name or add a distinguishing detail (e.g. middle initial).");
        }

        if (!"DIOCESE_ADMIN".equals(role) && !normalizeDioceseIds(request.getDioceseIds()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "dioceseIds may only be set when role is DIOCESE_ADMIN");
        }

        if ("DIOCESE_ADMIN".equals(role)) {
            return createDioceseAdmin(request, role, email, firstName, lastName);
        }

        Set<Long> parishIds = normalizeParishIds(request.getParishIds());
        List<Parish> parishes = parishIds.isEmpty()
                ? List.of()
                : parishRepository.findByIdIn(parishIds);

        if (parishes.size() != parishIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "One or more parishIds do not exist");
        }

        Map<Long, Parish> parishById = parishes.stream()
                .collect(Collectors.toMap(Parish::getId, Function.identity()));

        Long defaultParishId = request.getDefaultParishId();
        if (defaultParishId != null && !parishIds.contains(defaultParishId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "defaultParishId must be included in parishIds");
        }

        Parish defaultParish = defaultParishId != null ? parishById.get(defaultParishId) : null;
        if (defaultParish == null && parishIds.size() == 1) {
            defaultParish = parishes.get(0);
        }

        String displayName = buildDisplayName(
                request.getTitle(),
                request.getFirstName(),
                request.getLastName(),
                request.getUsername()
        );

        String passwordHash = passwordEncoder.encode(request.getDefaultPassword());

        AppUser user = AppUser.builder()
                .username(request.getUsername().trim())
                .passwordHash(passwordHash)
                .displayName(displayName)
                .parish(defaultParish)
                .role(role)
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .title(request.getTitle() != null ? request.getTitle().trim() : null)
                .email(email != null && !email.isBlank() ? email.trim() : null)
                .mustResetPassword(true)
                .parishAccesses(new HashSet<>(parishes))
                .build();

        AppUser saved = appUserRepository.save(user);
        return toResponse(saved);
    }

    private UserParishAccessResponse createDioceseAdmin(
            CreateUserRequest request,
            String role,
            String email,
            String firstName,
            String lastName
    ) {
        if (!normalizeParishIds(request.getParishIds()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "parishIds must be empty for DIOCESE_ADMIN; access is derived from dioceseIds");
        }
        Set<Long> dioceseIds = normalizeDioceseIds(request.getDioceseIds());
        if (dioceseIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dioceseIds is required for DIOCESE_ADMIN");
        }

        String displayName = buildDisplayName(
                request.getTitle(),
                request.getFirstName(),
                request.getLastName(),
                request.getUsername()
        );

        String passwordHash = passwordEncoder.encode(request.getDefaultPassword());

        AppUser user = AppUser.builder()
                .username(request.getUsername().trim())
                .passwordHash(passwordHash)
                .displayName(displayName)
                .role(role)
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .title(request.getTitle() != null ? request.getTitle().trim() : null)
                .email(email != null && !email.isBlank() ? email.trim() : null)
                .mustResetPassword(true)
                .parishAccesses(new HashSet<>())
                .dioceseAccesses(new HashSet<>())
                .build();

        dioceseAdminParishSyncService.assignDiocesesAndSyncParishes(user, dioceseIds);

        Long defaultParishId = request.getDefaultParishId();
        if (defaultParishId != null) {
            Set<Long> accessIds = user.getParishAccesses().stream()
                    .map(Parish::getId)
                    .collect(Collectors.toSet());
            if (!accessIds.contains(defaultParishId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "defaultParishId must be a parish in one of the assigned dioceses");
            }
            Parish defaultParish = parishRepository.findById(defaultParishId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parish not found: " + defaultParishId));
            user.setParish(defaultParish);
        } else {
            dioceseAdminParishSyncService.resolveDefaultParishAfterParishSync(user);
        }

        return toResponse(appUserRepository.save(user));
    }

    private void requireSuperAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Authentication required");
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AppUserDetails userDetails)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid authentication principal");
        }
        String role = normalizeRole(userDetails.getRole());
        if (!"SUPER_ADMIN".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super Admin role required");
        }
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private Set<Long> normalizeParishIds(Set<Long> parishIds) {
        if (parishIds == null) {
            return Collections.emptySet();
        }
        return new HashSet<>(parishIds);
    }

    private Set<Long> normalizeDioceseIds(Set<Long> dioceseIds) {
        if (dioceseIds == null) {
            return Collections.emptySet();
        }
        return new HashSet<>(dioceseIds);
    }

    private String buildDisplayName(String title, String firstName, String lastName, String username) {
        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isBlank()) {
            sb.append(title.trim()).append(" ");
        }
        if (firstName != null && !firstName.isBlank()) {
            sb.append(firstName.trim()).append(" ");
        }
        if (lastName != null && !lastName.isBlank()) {
            sb.append(lastName.trim());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? username : result;
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
}
