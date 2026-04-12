package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.ConfirmationResponse;
import com.wyloks.churchRegistry.dto.DioceseDashboardResponse;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionResponse;
import com.wyloks.churchRegistry.dto.MarriageResponse;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.*;
import com.wyloks.churchRegistry.repository.projection.ParishActivityRow;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.impl.DioceseDashboardServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DioceseDashboardServiceImplTest {

    @Mock
    ParishRepository parishRepository;

    @Mock
    DashboardRepository dashboardRepository;

    @Mock
    BaptismRepository baptismRepository;

    @Mock
    FirstHolyCommunionRepository communionRepository;

    @Mock
    ConfirmationRepository confirmationRepository;

    @Mock
    MarriageRepository marriageRepository;

    @Mock
    HolyOrderRepository holyOrderRepository;

    @Mock
    BaptismService baptismService;

    @Mock
    FirstHolyCommunionService communionService;

    @Mock
    ConfirmationService confirmationService;

    @Mock
    MarriageService marriageService;

    @Mock
    CurrentUserAccessService currentUserAccessService;

    DioceseDashboardServiceImpl dioceseDashboardService;

    Diocese diocese;
    Parish parish1;
    Parish parish2;

    @BeforeEach
    void setUp() {
        dioceseDashboardService = new DioceseDashboardServiceImpl(
                currentUserAccessService,
                parishRepository,
                dashboardRepository,
                baptismRepository,
                communionRepository,
                confirmationRepository,
                marriageRepository,
                holyOrderRepository,
                baptismService,
                communionService,
                confirmationService,
                marriageService
        );
        diocese = Diocese.builder()
                .dioceseName("Test Diocese")
                .code("TD")
                .description("Test")
                .build();
        parish1 = Parish.builder()
                .parishName("Parish 1")
                .diocese(diocese)
                .description("P1")
                .build();
        parish2 = Parish.builder()
                .parishName("Parish 2")
                .diocese(diocese)
                .description("P2")
                .build();
    }

    @Test
    void getDioceseDashboard_returnsCountsAndParishActivity() {
        Long dioceseId = 1L;
        parish1.setId(10L);
        parish2.setId(20L);
        diocese.setId(dioceseId);

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("sa", "SUPER_ADMIN", Set.of()));

        when(parishRepository.findByDioceseId(dioceseId))
                .thenReturn(List.of(parish1, parish2));
        Set<Long> allParishIds = Set.of(10L, 20L);
        when(baptismRepository.countByParishIdIn(allParishIds)).thenReturn(15L);
        when(communionRepository.countByBaptismParishIdIn(allParishIds)).thenReturn(8L);
        when(confirmationRepository.countByBaptismParishIdIn(allParishIds)).thenReturn(5L);
        when(marriageRepository.countByBaptismParishIdIn(allParishIds)).thenReturn(3L);
        when(holyOrderRepository.countByBaptismParishIdIn(allParishIds)).thenReturn(1L);

        ParishActivityRow row1 = createParishActivityRow(10L, "Parish 1", 10, 5, 3, 2);
        ParishActivityRow row2 = createParishActivityRow(20L, "Parish 2", 5, 3, 2, 1);
        when(dashboardRepository.getParishActivity(dioceseId))
                .thenReturn(List.of(row1, row2));

        when(baptismService.findByParishIdIn(eq(Set.of(10L, 20L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(communionService.findByParishIdIn(eq(Set.of(10L, 20L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(confirmationService.findByParishIdIn(eq(Set.of(10L, 20L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(marriageService.findByParishIdIn(eq(Set.of(10L, 20L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        assertThat(result.getCounts())
                .containsEntry("parishes", 2L)
                .containsEntry("baptisms", 15L)
                .containsEntry("communions", 8L)
                .containsEntry("confirmations", 5L)
                .containsEntry("marriages", 3L)
                .containsEntry("holyOrders", 1L);

        assertThat(result.getParishActivity()).hasSize(2);
        assertThat(result.getParishActivity().get(0).getParishName()).isEqualTo("Parish 1");
        assertThat(result.getParishActivity().get(0).getBaptisms()).isEqualTo(10L);
        assertThat(result.getParishActivity().get(1).getParishName()).isEqualTo("Parish 2");
        assertThat(result.getParishActivity().get(1).getBaptisms()).isEqualTo(5L);

        assertThat(result.getRecentSacraments()).isNotNull();
        assertThat(result.getRecentSacraments().getBaptisms()).isEmpty();
        assertThat(result.getRecentSacraments().getCommunions()).isEmpty();

        assertThat(result.getMonthly()).isNotNull();
        assertThat(result.getMonthly().getBaptisms()).hasSize(12);
        assertThat(result.getMonthly().getBaptisms()).containsOnly(0L);
    }

    @Test
    void getDioceseDashboard_returnsEmptyWhenNoParishes() {
        Long dioceseId = 1L;
        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("sa", "SUPER_ADMIN", Set.of()));
        when(parishRepository.findByDioceseId(dioceseId)).thenReturn(List.of());

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        assertThat(result.getCounts())
                .containsEntry("parishes", 0L)
                .containsEntry("baptisms", 0L)
                .containsEntry("communions", 0L)
                .containsEntry("confirmations", 0L)
                .containsEntry("marriages", 0L)
                .containsEntry("holyOrders", 0L);
        assertThat(result.getParishActivity()).isEmpty();
        assertThat(result.getRecentSacraments().getBaptisms()).isEmpty();
        assertThat(result.getMonthly().getBaptisms()).hasSize(12);
    }

    @Test
    void getDioceseDashboard_includesRecentSacraments() {
        Long dioceseId = 1L;
        parish1.setId(10L);
        diocese.setId(dioceseId);

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("sa", "SUPER_ADMIN", Set.of()));
        when(parishRepository.findByDioceseId(dioceseId)).thenReturn(List.of(parish1));
        when(baptismRepository.countByParishIdIn(Set.of(10L))).thenReturn(1L);
        when(communionRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(confirmationRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(marriageRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(holyOrderRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);

        when(dashboardRepository.getParishActivity(dioceseId))
                .thenReturn(List.of(createParishActivityRow(10L, "Parish 1", 1, 0, 0, 0)));

        BaptismResponse baptism = BaptismResponse.builder()
                .id(100L)
                .baptismName("John")
                .surname("Doe")
                .parishId(10L)
                .build();
        when(baptismService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(baptism)));
        when(communionService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(confirmationService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(marriageService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        assertThat(result.getRecentSacraments().getBaptisms()).hasSize(1);
        assertThat(result.getRecentSacraments().getBaptisms().get(0).getBaptismName()).isEqualTo("John");
    }

    @Test
    void getDioceseDashboard_aggregatesMonthlyDataFromRecords() {
        Long dioceseId = 1L;
        parish1.setId(10L);
        diocese.setId(dioceseId);

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("sa", "SUPER_ADMIN", Set.of()));
        when(parishRepository.findByDioceseId(dioceseId)).thenReturn(List.of(parish1));
        when(baptismRepository.countByParishIdIn(Set.of(10L))).thenReturn(2L);
        when(communionRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(confirmationRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(marriageRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);
        when(holyOrderRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);

        when(dashboardRepository.getParishActivity(dioceseId))
                .thenReturn(List.of(createParishActivityRow(10L, "Parish 1", 2, 0, 0, 0)));

        // Jan (0) and Mar (2) baptisms
        BaptismResponse b1 = BaptismResponse.builder()
                .id(1L)
                .createdAt(OffsetDateTime.of(2025, 1, 15, 0, 0, 0, 0, ZoneOffset.UTC))
                .dateOfBirth(LocalDate.of(2024, 12, 1))
                .build();
        BaptismResponse b2 = BaptismResponse.builder()
                .id(2L)
                .createdAt(OffsetDateTime.of(2025, 3, 20, 0, 0, 0, 0, ZoneOffset.UTC))
                .dateOfBirth(LocalDate.of(2025, 2, 10))
                .build();
        when(baptismService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(b1, b2)));
        when(communionService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(confirmationService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(marriageService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        List<Long> monthlyBaptisms = result.getMonthly().getBaptisms();
        assertThat(monthlyBaptisms).hasSize(12);
        assertThat(monthlyBaptisms.get(0)).isEqualTo(1L);  // Jan
        assertThat(monthlyBaptisms.get(2)).isEqualTo(1L);  // Mar
        assertThat(monthlyBaptisms.get(1)).isZero();
    }

    @Test
    void getDioceseDashboard_includesAllSacramentTypesInRecent() {
        Long dioceseId = 1L;
        parish1.setId(10L);
        diocese.setId(dioceseId);

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("sa", "SUPER_ADMIN", Set.of()));
        when(parishRepository.findByDioceseId(dioceseId)).thenReturn(List.of(parish1));
        when(baptismRepository.countByParishIdIn(Set.of(10L))).thenReturn(1L);
        when(communionRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(1L);
        when(confirmationRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(1L);
        when(marriageRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(1L);
        when(holyOrderRepository.countByBaptismParishIdIn(Set.of(10L))).thenReturn(0L);

        when(dashboardRepository.getParishActivity(dioceseId))
                .thenReturn(List.of(createParishActivityRow(10L, "Parish 1", 1, 1, 1, 1)));

        BaptismResponse baptism = BaptismResponse.builder().id(1L).baptismName("B").parishId(10L).build();
        FirstHolyCommunionResponse communion = FirstHolyCommunionResponse.builder().id(2L).parish("St Mary").build();
        ConfirmationResponse confirmation = ConfirmationResponse.builder().id(3L).parish("St Mary").build();
        MarriageResponse marriage = MarriageResponse.builder().id(4L).partnersName("A & B").build();

        when(baptismService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(baptism)));
        when(communionService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(communion)));
        when(confirmationService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(confirmation)));
        when(marriageService.findByParishIdIn(eq(Set.of(10L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(marriage)));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        assertThat(result.getRecentSacraments().getBaptisms()).hasSize(1);
        assertThat(result.getRecentSacraments().getCommunions()).hasSize(1);
        assertThat(result.getRecentSacraments().getConfirmations()).hasSize(1);
        assertThat(result.getRecentSacraments().getMarriages()).hasSize(1);
    }

    @Test
    void getDioceseDashboard_parishAdmin_throwsForbidden() {
        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "ADMIN", Set.of(10L)));

        assertThatThrownBy(() -> dioceseDashboardService.getDioceseDashboard(1L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("SUPER_ADMIN and DIOCESE_ADMIN");
                });
    }

    @Test
    void getDioceseDashboard_dioceseAdmin_aggregatesOnlyAssignedParishesInDiocese() {
        Long dioceseId = 1L;
        parish1.setId(10L);
        parish2.setId(20L);
        diocese.setId(dioceseId);

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("da", "DIOCESE_ADMIN", Set.of(10L)));

        when(parishRepository.findByIdInAndDioceseId(Set.of(10L), dioceseId))
                .thenReturn(List.of(parish1));

        Set<Long> scoped = Set.of(10L);
        when(baptismRepository.countByParishIdIn(scoped)).thenReturn(3L);
        when(communionRepository.countByBaptismParishIdIn(scoped)).thenReturn(1L);
        when(confirmationRepository.countByBaptismParishIdIn(scoped)).thenReturn(0L);
        when(marriageRepository.countByBaptismParishIdIn(scoped)).thenReturn(0L);
        when(holyOrderRepository.countByBaptismParishIdIn(scoped)).thenReturn(0L);

        ParishActivityRow row1 = createParishActivityRow(10L, "Parish 1", 3, 1, 0, 0);
        ParishActivityRow row2 = createParishActivityRow(20L, "Parish 2", 99, 99, 99, 99);
        when(dashboardRepository.getParishActivity(dioceseId)).thenReturn(List.of(row1, row2));

        when(baptismService.findByParishIdIn(eq(scoped), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(communionService.findByParishIdIn(eq(scoped), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(confirmationService.findByParishIdIn(eq(scoped), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(marriageService.findByParishIdIn(eq(scoped), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(dioceseId);

        assertThat(result.getCounts())
                .containsEntry("parishes", 1L)
                .containsEntry("baptisms", 3L)
                .containsEntry("communions", 1L);
        assertThat(result.getParishActivity()).hasSize(1);
        assertThat(result.getParishActivity().get(0).getParishId()).isEqualTo(10L);
        assertThat(result.getParishActivity().get(0).getBaptisms()).isEqualTo(3L);
    }

    private static ParishActivityRow createParishActivityRow(Long parishId, String parishName,
                                                           long baptisms, long communions, long confirmations, long marriages) {
        return new ParishActivityRow() {
            @Override
            public Long getParishId() { return parishId; }
            @Override
            public String getParishName() { return parishName; }
            @Override
            public long getBaptisms() { return baptisms; }
            @Override
            public long getCommunions() { return communions; }
            @Override
            public long getConfirmations() { return confirmations; }
            @Override
            public long getMarriages() { return marriages; }
        };
    }
}
