package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.config.CacheConfig;
import com.wyloks.churchRegistry.dto.DioceseRequest;
import com.wyloks.churchRegistry.dto.DioceseResponse;
import com.wyloks.churchRegistry.dto.DioceseWithParishesResponse;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.DioceseRepository;
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
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DioceseServiceImpl implements DioceseService {

    private final DioceseRepository dioceseRepository;
    private final CurrentUserAccessService currentUserAccessService;

    @Override
    @Transactional(readOnly = true)
    public List<DioceseResponse> findAll() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        List<Diocese> dioceses = currentUser.isAdmin()
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
        List<Diocese> dioceses = currentUser.isAdmin()
                ? dioceseRepository.findAllWithParishes()
                : currentUser.parishIds().isEmpty()
                    ? List.of()
                    : dioceseRepository.findDistinctByParishesIdIn(currentUser.parishIds());

        Set<Long> allowedParishIds = currentUser.isAdmin() ? null : currentUser.parishIds();
        return dioceses.stream()
                .map(d -> toResponseWithParishes(d, allowedParishIds))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DioceseResponse> findById(Long id) {
        return dioceseRepository.findById(id).map(this::toResponse);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {CacheConfig.CACHE_DIOCESES_WITH_PARISHES, CacheConfig.CACHE_PARISHES_BY_DIOCESE}, allEntries = true)
    public DioceseResponse create(DioceseRequest request) {
        requireAdminRole();
        String name = NameUtils.capitalizeNameOrEmpty(request.getDioceseName());
        if (dioceseRepository.existsByDioceseNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A diocese with that name already exists");
        }
        Diocese entity = Diocese.builder()
                .dioceseName(name)
                .code(request.getCode())
                .description(request.getDescription())
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

    private void requireAdminRole() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }
}
