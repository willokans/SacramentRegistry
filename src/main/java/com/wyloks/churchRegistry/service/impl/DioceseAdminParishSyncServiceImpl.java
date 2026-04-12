package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.service.DioceseAdminParishSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DioceseAdminParishSyncServiceImpl implements DioceseAdminParishSyncService {

    private final DioceseRepository dioceseRepository;
    private final ParishRepository parishRepository;
    private final AppUserRepository appUserRepository;

    @Override
    @Transactional
    public void assignDiocesesAndSyncParishes(AppUser user, Set<Long> dioceseIds) {
        if (dioceseIds == null || dioceseIds.isEmpty()) {
            throw new IllegalArgumentException("dioceseIds must not be empty");
        }
        List<Diocese> dioceses = dioceseRepository.findAllById(dioceseIds);
        if (dioceses.size() != dioceseIds.size()) {
            throw new IllegalArgumentException("One or more dioceseIds do not exist");
        }
        user.getDioceseAccesses().clear();
        user.getDioceseAccesses().addAll(new HashSet<>(dioceses));

        List<Parish> parishes = parishRepository.findByDioceseIdIn(dioceseIds);
        user.getParishAccesses().clear();
        user.getParishAccesses().addAll(new HashSet<>(parishes));
    }

    @Override
    @Transactional
    public void clearDioceseAccess(AppUser user) {
        user.getDioceseAccesses().clear();
    }

    @Override
    @Transactional
    public void refreshParishAccessForDioceseAdmins(Long dioceseId) {
        List<AppUser> admins = appUserRepository.findDioceseAdminsForDiocese(dioceseId);
        for (AppUser user : admins) {
            Set<Long> assignedDioceseIds = user.getDioceseAccesses().stream()
                    .map(Diocese::getId)
                    .collect(Collectors.toSet());
            if (assignedDioceseIds.isEmpty()) {
                continue;
            }
            assignDiocesesAndSyncParishes(user, assignedDioceseIds);
            resolveDefaultParishAfterParishSync(user);
            appUserRepository.save(user);
        }
    }

    @Override
    @Transactional
    public void resolveDefaultParishAfterParishSync(AppUser user) {
        Set<Long> accessIds = user.getParishAccesses().stream()
                .map(Parish::getId)
                .collect(Collectors.toSet());
        Long currentDefaultId = user.getParish() != null ? user.getParish().getId() : null;
        if (currentDefaultId != null && accessIds.contains(currentDefaultId)) {
            return;
        }
        if (accessIds.isEmpty()) {
            user.setParish(null);
            return;
        }
        if (accessIds.size() == 1) {
            Long id = accessIds.iterator().next();
            user.setParish(parishRepository.findById(id).orElse(null));
            return;
        }
        user.setParish(null);
    }
}
