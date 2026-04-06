package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.config.CacheConfig;
import com.wyloks.churchRegistry.dto.DioceseRequest;
import com.wyloks.churchRegistry.dto.DioceseResponse;
import com.wyloks.churchRegistry.dto.DioceseWithParishesResponse;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.DioceseService;
import com.wyloks.churchRegistry.util.NameUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Directory APIs: non–{@code SUPER_ADMIN} users only see dioceses and parishes tied to their assignments
 * (same Option B rule as {@link com.wyloks.churchRegistry.service.impl.DioceseDashboardServiceImpl}).
 */
@Service
@RequiredArgsConstructor
public class DioceseServiceImpl implements DioceseService {

    private final DioceseRepository dioceseRepository;
    private final ParishRepository parishRepository;
    private final CurrentUserAccessService currentUserAccessService;

    @Override
    @Transactional(readOnly = true)
    public List<DioceseResponse> findAll() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        List<Diocese> dioceses = currentUser.isSuperAdmin()
                ? dioceseRepository.findAll()
                : currentUser.parishIds().isEmpty()
                    ? List.of()
                    : dioceseRepository.findDistinctByParishesIdIn(currentUser.parishIds());

        return dioceses.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheConfig.CACHE_DIOCESES_WITH_PARISHES, keyGenerator = "dioceseParishCacheKeyGenerator")
    public List<DioceseWithParishesResponse> findDiocesesWithParishes() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        List<Diocese> dioceses = currentUser.isSuperAdmin()
                ? dioceseRepository.findAllWithParishes()
                : currentUser.parishIds().isEmpty()
                    ? List.of()
                    : dioceseRepository.findDistinctByParishesIdIn(currentUser.parishIds());

        Set<Long> allowedParishIds = currentUser.isSuperAdmin() ? null : currentUser.parishIds();
        return dioceses.stream()
                .map(d -> toResponseWithParishes(d, allowedParishIds))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DioceseResponse> searchByCountryAndQuery(String countryCode, String query) {
        String normalizedCountryCode = normalizeCountryCode(countryCode);
        String normalizedQuery = normalizeQuery(query);

        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (currentUser.isSuperAdmin()) {
            return (normalizedQuery == null
                    ? dioceseRepository.findByCountryCodeIgnoreCaseOrderByDioceseNameAsc(normalizedCountryCode)
                    : dioceseRepository.findByCountryCodeIgnoreCaseAndDioceseNameContainingIgnoreCaseOrderByDioceseNameAsc(
                            normalizedCountryCode,
                            normalizedQuery
                    ))
                    .stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }

        if (currentUser.parishIds().isEmpty()) {
            return List.of();
        }

        String loweredQuery = normalizedQuery == null ? null : normalizedQuery.toLowerCase(Locale.ROOT);
        return dioceseRepository.findDistinctByParishesIdIn(currentUser.parishIds()).stream()
                .filter(d -> d.getCountryCode() != null && d.getCountryCode().equalsIgnoreCase(normalizedCountryCode))
                .filter(d -> loweredQuery == null || (d.getDioceseName() != null
                        && d.getDioceseName().toLowerCase(Locale.ROOT).contains(loweredQuery)))
                .sorted((left, right) -> String.CASE_INSENSITIVE_ORDER.compare(
                        left.getDioceseName() == null ? "" : left.getDioceseName(),
                        right.getDioceseName() == null ? "" : right.getDioceseName()
                ))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DioceseResponse> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return dioceseRepository.findById(id).flatMap(d -> {
            CurrentUserAccessService.CurrentUserAccess u = currentUserAccessService.currentUser();
            if (u.isSuperAdmin()) {
                return Optional.of(toResponse(d));
            }
            if (u.parishIds().isEmpty() || parishRepository.findByIdInAndDioceseId(u.parishIds(), id).isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(toResponse(d));
        });
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {CacheConfig.CACHE_DIOCESES_WITH_PARISHES, CacheConfig.CACHE_PARISHES_BY_DIOCESE}, allEntries = true)
    public DioceseResponse create(DioceseRequest request) {
        requireSuperAdminRole();
        String name = NameUtils.capitalizeNameOrEmpty(request.getDioceseName());
        if (dioceseRepository.existsByDioceseNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A diocese with that name already exists");
        }
        Diocese entity = Diocese.builder()
                .dioceseName(name)
                .code(request.getCode())
                .description(request.getDescription())
                .countryCode(normalizeOptionalCountryCode(request.getCountryCode()))
                .countryName(normalizeOptionalText(request.getCountryName()))
                .ordinaryName(normalizeOptionalText(request.getOrdinaryName()))
                .ordinaryTitle(normalizeOptionalText(request.getOrdinaryTitle()))
                .build();
        entity = dioceseRepository.save(entity);
        return toResponse(entity);
    }

    private DioceseResponse toResponse(Diocese e) {
        return DioceseResponse.builder()
                .id(e.getId())
                .dioceseName(e.getDioceseName())
                .code(e.getCode())
                .description(e.getDescription())
                .countryCode(e.getCountryCode())
                .countryName(e.getCountryName())
                .ordinaryName(e.getOrdinaryName())
                .ordinaryTitle(e.getOrdinaryTitle())
                .build();
    }

    private DioceseWithParishesResponse toResponseWithParishes(Diocese e, Set<Long> allowedParishIds) {
        List<ParishResponse> parishes = e.getParishes() != null
                ? e.getParishes().stream()
                        .filter(p -> allowedParishIds == null || (p != null && p.getId() != null && allowedParishIds.contains(p.getId())))
                        .map(this::toParishResponse)
                        .collect(Collectors.toList())
                : List.of();
        return DioceseWithParishesResponse.builder()
                .id(e.getId())
                .dioceseName(e.getDioceseName())
                .code(e.getCode())
                .description(e.getDescription())
                .parishes(parishes)
                .build();
    }

    private ParishResponse toParishResponse(Parish p) {
        return ParishResponse.builder()
                .id(p.getId())
                .parishName(p.getParishName())
                .dioceseId(p.getDiocese() != null ? p.getDiocese().getId() : null)
                .description(p.getDescription())
                .requireMarriageConfirmation(p.isRequireMarriageConfirmation())
                .build();
    }

    private String normalizeCountryCode(String countryCode) {
        if (countryCode == null || countryCode.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "countryCode is required");
        }
        return countryCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeQuery(String query) {
        if (query == null) {
            return null;
        }
        String trimmed = query.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeOptionalCountryCode(String countryCode) {
        String normalized = normalizeOptionalText(countryCode);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private void requireSuperAdminRole() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isSuperAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super administrator role required");
        }
    }
}
