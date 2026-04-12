package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.config.CacheConfig;
import com.wyloks.churchRegistry.dto.ParishMarriageRequirementsResponse;
import com.wyloks.churchRegistry.dto.ParishRequest;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.DioceseAdminParishSyncService;
import com.wyloks.churchRegistry.service.ParishService;
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
import java.util.stream.Collectors;

/**
 * Parishes-by-diocese listing follows the same parish scope as directory and diocese dashboard (Option B).
 */
@Service
@RequiredArgsConstructor
public class ParishServiceImpl implements ParishService {

    private final ParishRepository parishRepository;
    private final DioceseRepository dioceseRepository;
    private final CurrentUserAccessService currentUserAccessService;
    private final DioceseAdminParishSyncService dioceseAdminParishSyncService;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheConfig.CACHE_PARISHES_BY_DIOCESE, keyGenerator = "dioceseParishCacheKeyGenerator")
    public List<ParishResponse> findByDioceseId(Long dioceseId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        List<Parish> parishes = currentUser.isSuperAdmin()
                ? parishRepository.findByDioceseId(dioceseId)
                : currentUser.parishIds().isEmpty()
                    ? List.of()
                    : parishRepository.findByIdInAndDioceseId(currentUser.parishIds(), dioceseId);

        return parishes.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ParishResponse> findById(Long id) {
        return parishRepository.findById(id).map(this::toResponse);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {CacheConfig.CACHE_DIOCESES_WITH_PARISHES, CacheConfig.CACHE_PARISHES_BY_DIOCESE}, allEntries = true)
    public ParishResponse create(ParishRequest request) {
        requireSuperAdminRole();
        Diocese diocese = dioceseRepository.findById(request.getDioceseId())
                .orElseThrow(() -> new IllegalArgumentException("Diocese not found: " + request.getDioceseId()));
        String parishName = NameUtils.capitalizeNameOrEmpty(request.getParishName());
        if (parishRepository.existsByParishNameIgnoreCaseAndDioceseId(parishName, diocese.getId())) {
            throw new IllegalArgumentException("A parish with that name already exists in this diocese");
        }
        Parish entity = Parish.builder()
                .parishName(parishName)
                .diocese(diocese)
                .description(request.getDescription())
                .requireMarriageConfirmation(true)
                .build();
        entity = parishRepository.save(entity);
        dioceseAdminParishSyncService.refreshParishAccessForDioceseAdmins(diocese.getId());
        return toResponse(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ParishMarriageRequirementsResponse> getMarriageRequirements(Long parishId) {
        return parishRepository.findById(parishId)
                .map(p -> ParishMarriageRequirementsResponse.builder()
                        .parishId(p.getId())
                        .requireMarriageConfirmation(p.isRequireMarriageConfirmation())
                        .build());
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = {CacheConfig.CACHE_DIOCESES_WITH_PARISHES, CacheConfig.CACHE_PARISHES_BY_DIOCESE}, allEntries = true)
    public ParishMarriageRequirementsResponse updateMarriageRequirements(Long parishId, boolean requireMarriageConfirmation) {
        Parish p = parishRepository.findById(parishId)
                .orElseThrow(() -> new IllegalArgumentException("Parish not found: " + parishId));
        p.setRequireMarriageConfirmation(requireMarriageConfirmation);
        parishRepository.save(p);
        return ParishMarriageRequirementsResponse.builder()
                .parishId(parishId)
                .requireMarriageConfirmation(requireMarriageConfirmation)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isMarriageConfirmationRequired(Long parishId) {
        return parishRepository.findById(parishId)
                .map(Parish::isRequireMarriageConfirmation)
                .orElse(true);
    }

    private ParishResponse toResponse(Parish e) {
        return ParishResponse.builder()
                .id(e.getId())
                .parishName(e.getParishName())
                .dioceseId(e.getDiocese().getId())
                .description(e.getDescription())
                .requireMarriageConfirmation(e.isRequireMarriageConfirmation())
                .build();
    }

    private void requireSuperAdminRole() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isSuperAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super administrator role required");
        }
    }
}
