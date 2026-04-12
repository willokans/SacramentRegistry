package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.config.CacheConfig;
import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.ConfirmationResponse;
import com.wyloks.churchRegistry.dto.DioceseDashboardResponse;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionResponse;
import com.wyloks.churchRegistry.dto.MarriageResponse;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.ConfirmationRepository;
import com.wyloks.churchRegistry.repository.DashboardRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.HolyOrderRepository;
import com.wyloks.churchRegistry.repository.MarriageRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.repository.projection.ParishActivityRow;
import com.wyloks.churchRegistry.service.BaptismService;
import com.wyloks.churchRegistry.service.ConfirmationService;
import com.wyloks.churchRegistry.service.DioceseDashboardService;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.FirstHolyCommunionService;
import com.wyloks.churchRegistry.service.MarriageService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DioceseDashboardServiceImpl implements DioceseDashboardService {

    private static final int DASHBOARD_PAGE_SIZE = 50;
    private static final int MONTHLY_PAGE_SIZE = 200;

    private final CurrentUserAccessService currentUserAccessService;
    private final ParishRepository parishRepository;
    private final DashboardRepository dashboardRepository;
    private final BaptismRepository baptismRepository;
    private final FirstHolyCommunionRepository communionRepository;
    private final ConfirmationRepository confirmationRepository;
    private final MarriageRepository marriageRepository;
    private final HolyOrderRepository holyOrderRepository;
    private final BaptismService baptismService;
    private final FirstHolyCommunionService communionService;
    private final ConfirmationService confirmationService;
    private final MarriageService marriageService;

    @Override
    @Cacheable(cacheNames = CacheConfig.CACHE_DIOCESE_DASHBOARD, keyGenerator = "dioceseDashboardCacheKeyGenerator")
    public DioceseDashboardResponse getDioceseDashboard(Long dioceseId) {
        CurrentUserAccessService.CurrentUserAccess user = currentUserAccessService.currentUser();
        if (!user.canAccessDioceseDashboard()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Diocese dashboard access denied. Only SUPER_ADMIN and DIOCESE_ADMIN may view the diocesan dashboard.");
        }
        List<com.wyloks.churchRegistry.entity.Parish> parishesInScope = user.isSuperAdmin()
                ? parishRepository.findByDioceseId(dioceseId)
                : parishRepository.findByIdInAndDioceseId(user.parishIds(), dioceseId);
        Set<Long> parishIds = parishesInScope.stream()
                .map(com.wyloks.churchRegistry.entity.Parish::getId)
                .collect(Collectors.toSet());

        Map<String, Long> counts = buildCounts(parishIds);
        List<DioceseDashboardResponse.ParishActivityItem> parishActivity = buildParishActivity(dioceseId, parishIds);
        DioceseDashboardResponse.RecentSacraments recentSacraments = buildRecentSacraments(parishIds);
        DioceseDashboardResponse.MonthlyData monthly = buildMonthlyData(parishIds);

        return DioceseDashboardResponse.builder()
                .counts(counts)
                .parishActivity(parishActivity)
                .recentSacraments(recentSacraments)
                .monthly(monthly)
                .build();
    }

    private Map<String, Long> buildCounts(Set<Long> parishIds) {
        if (parishIds.isEmpty()) {
            return Map.of(
                    "parishes", 0L,
                    "baptisms", 0L,
                    "communions", 0L,
                    "confirmations", 0L,
                    "marriages", 0L,
                    "holyOrders", 0L
            );
        }
        long baptisms = baptismRepository.countByParishIdIn(parishIds);
        long communions = communionRepository.countByBaptismParishIdIn(parishIds);
        long confirmations = confirmationRepository.countByBaptismParishIdIn(parishIds);
        long marriages = marriageRepository.countByBaptismParishIdIn(parishIds);
        long holyOrders = holyOrderRepository.countByBaptismParishIdIn(parishIds);

        return Map.of(
                "parishes", (long) parishIds.size(),
                "baptisms", baptisms,
                "communions", communions,
                "confirmations", confirmations,
                "marriages", marriages,
                "holyOrders", holyOrders
        );
    }

    private List<DioceseDashboardResponse.ParishActivityItem> buildParishActivity(Long dioceseId, Set<Long> scopeParishIds) {
        if (scopeParishIds.isEmpty()) {
            return List.of();
        }
        List<ParishActivityRow> rows = dashboardRepository.getParishActivity(dioceseId);
        return rows.stream()
                .filter(row -> row.getParishId() != null && scopeParishIds.contains(row.getParishId()))
                .map(row -> DioceseDashboardResponse.ParishActivityItem.builder()
                        .parishId(row.getParishId())
                        .parishName(row.getParishName())
                        .baptisms(row.getBaptisms())
                        .communions(row.getCommunions())
                        .confirmations(row.getConfirmations())
                        .marriages(row.getMarriages())
                        .build())
                .toList();
    }

    private DioceseDashboardResponse.RecentSacraments buildRecentSacraments(Set<Long> parishIds) {
        if (parishIds.isEmpty()) {
            return DioceseDashboardResponse.RecentSacraments.builder()
                    .baptisms(List.of())
                    .communions(List.of())
                    .confirmations(List.of())
                    .marriages(List.of())
                    .build();
        }

        Sort sortByCreatedDesc = Sort.by(Sort.Direction.DESC, "createdAt");
        PageRequest page = PageRequest.of(0, DASHBOARD_PAGE_SIZE, sortByCreatedDesc);

        List<BaptismResponse> baptisms = baptismService.findByParishIdIn(parishIds, page).getContent();
        List<FirstHolyCommunionResponse> communions = communionService.findByParishIdIn(parishIds, page).getContent();
        List<ConfirmationResponse> confirmations = confirmationService.findByParishIdIn(parishIds, page).getContent();
        List<MarriageResponse> marriages = marriageService.findByParishIdIn(parishIds, page).getContent();

        return DioceseDashboardResponse.RecentSacraments.builder()
                .baptisms(baptisms)
                .communions(communions)
                .confirmations(confirmations)
                .marriages(marriages)
                .build();
    }

    private DioceseDashboardResponse.MonthlyData buildMonthlyData(Set<Long> parishIds) {
        List<Long> baptisms = new ArrayList<>(List.of(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        List<Long> communions = new ArrayList<>(List.of(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        List<Long> confirmations = new ArrayList<>(List.of(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        List<Long> marriages = new ArrayList<>(List.of(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));

        if (parishIds.isEmpty()) {
            return DioceseDashboardResponse.MonthlyData.builder()
                    .baptisms(baptisms)
                    .communions(communions)
                    .confirmations(confirmations)
                    .marriages(marriages)
                    .build();
        }

        Sort sortByCreatedDesc = Sort.by(Sort.Direction.DESC, "createdAt");
        PageRequest page = PageRequest.of(0, MONTHLY_PAGE_SIZE, sortByCreatedDesc);

        List<BaptismResponse> baptismRecords = baptismService.findByParishIdIn(parishIds, page).getContent();
        List<FirstHolyCommunionResponse> communionRecords = communionService.findByParishIdIn(parishIds, page).getContent();
        List<ConfirmationResponse> confirmationRecords = confirmationService.findByParishIdIn(parishIds, page).getContent();
        List<MarriageResponse> marriageRecords = marriageService.findByParishIdIn(parishIds, page).getContent();

        for (BaptismResponse r : baptismRecords) {
            int month = getMonthIndex(r.getCreatedAt(), r.getDateOfBirth() != null ? r.getDateOfBirth().toString() : null);
            if (month >= 0 && month < 12) {
                baptisms.set(month, baptisms.get(month) + 1);
            }
        }
        for (FirstHolyCommunionResponse r : communionRecords) {
            int month = getMonthIndex(r.getCreatedAt(), r.getCommunionDate() != null ? r.getCommunionDate().toString() : null);
            if (month >= 0 && month < 12) {
                communions.set(month, communions.get(month) + 1);
            }
        }
        for (ConfirmationResponse r : confirmationRecords) {
            int month = getMonthIndex(r.getCreatedAt(), r.getConfirmationDate() != null ? r.getConfirmationDate().toString() : null);
            if (month >= 0 && month < 12) {
                confirmations.set(month, confirmations.get(month) + 1);
            }
        }
        for (MarriageResponse r : marriageRecords) {
            int month = getMonthIndex(r.getCreatedAt(), r.getMarriageDate() != null ? r.getMarriageDate().toString() : null);
            if (month >= 0 && month < 12) {
                marriages.set(month, marriages.get(month) + 1);
            }
        }

        return DioceseDashboardResponse.MonthlyData.builder()
                .baptisms(baptisms)
                .communions(communions)
                .confirmations(confirmations)
                .marriages(marriages)
                .build();
    }

    /**
     * Returns 0-11 for month index from creation or sacrament date, or -1 if not parseable.
     */
    private int getMonthIndex(OffsetDateTime createdAt, String fallbackDate) {
        String source = createdAt != null ? createdAt.toString() : fallbackDate;
        if (source == null) return -1;
        var isoLike = java.util.regex.Pattern.compile("^(\\d{4})-(\\d{2})").matcher(source);
        if (isoLike.find()) {
            int month = Integer.parseInt(isoLike.group(2), 10) - 1;
            return month >= 0 && month < 12 ? month : -1;
        }
        try {
            java.time.LocalDate d = java.time.LocalDate.parse(source.substring(0, Math.min(10, source.length())));
            return d.getMonthValue() - 1;
        } catch (Exception ignored) {
            return -1;
        }
    }
}
