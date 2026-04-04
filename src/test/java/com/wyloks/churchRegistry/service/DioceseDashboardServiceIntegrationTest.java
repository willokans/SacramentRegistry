package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.DioceseDashboardResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Baptism;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.FirstHolyCommunion;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.security.AppUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link DioceseDashboardService} with real database.
 */
@SpringBootTest
@Transactional
class DioceseDashboardServiceIntegrationTest {

    @Autowired
    DioceseDashboardService dioceseDashboardService;

    @Autowired
    DioceseRepository dioceseRepository;

    @Autowired
    ParishRepository parishRepository;

    @Autowired
    BaptismRepository baptismRepository;

    @Autowired
    FirstHolyCommunionRepository communionRepository;

    Diocese diocese;
    Parish parish1;
    Parish parish2;

    @BeforeEach
    void setUp() {
        AppUser superUser = AppUser.builder()
                .username("diocese-dashboard-it")
                .passwordHash("unused")
                .role("SUPER_ADMIN")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new AppUserDetails(superUser), null,
                        new AppUserDetails(superUser).getAuthorities()));

        diocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Integration Test Diocese")
                .code("ITD")
                .description("For diocese dashboard integration tests")
                .build());

        parish1 = parishRepository.save(Parish.builder()
                .parishName("Integration Parish 1")
                .diocese(diocese)
                .description("P1")
                .build());

        parish2 = parishRepository.save(Parish.builder()
                .parishName("Integration Parish 2")
                .diocese(diocese)
                .description("P2")
                .build());
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getDioceseDashboard_returnsCountsAndParishActivity() {
        Baptism b1 = baptismRepository.save(createBaptism(parish1));
        Baptism b2 = baptismRepository.save(createBaptism(parish1));
        baptismRepository.save(createBaptism(parish2));

        communionRepository.save(FirstHolyCommunion.builder()
                .baptism(b1)
                .communionDate(LocalDate.of(2024, 6, 1))
                .officiatingPriest("Fr. X")
                .parish("St Mary")
                .build());

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(diocese.getId());

        assertThat(result.getCounts())
                .containsEntry("parishes", 2L)
                .containsEntry("baptisms", 3L)
                .containsEntry("communions", 1L);

        assertThat(result.getParishActivity()).hasSize(2);
        assertThat(result.getParishActivity())
                .anyMatch(p -> "Integration Parish 1".equals(p.getParishName()) && p.getBaptisms() == 2 && p.getCommunions() == 1)
                .anyMatch(p -> "Integration Parish 2".equals(p.getParishName()) && p.getBaptisms() == 1 && p.getCommunions() == 0);

        assertThat(result.getRecentSacraments()).isNotNull();
        assertThat(result.getRecentSacraments().getBaptisms()).hasSize(3);
        assertThat(result.getMonthly()).isNotNull();
        assertThat(result.getMonthly().getBaptisms()).hasSize(12);
    }

    @Test
    void getDioceseDashboard_returnsEmptyWhenDioceseHasNoParishes() {
        Diocese emptyDiocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Empty Diocese")
                .code("ED")
                .description("No parishes")
                .build());

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(emptyDiocese.getId());

        assertThat(result.getCounts())
                .containsEntry("parishes", 0L)
                .containsEntry("baptisms", 0L)
                .containsEntry("communions", 0L);
        assertThat(result.getParishActivity()).isEmpty();
        assertThat(result.getRecentSacraments().getBaptisms()).isEmpty();
        assertThat(result.getMonthly().getBaptisms()).hasSize(12);
    }

    @Test
    void getDioceseDashboard_isolatesDataBetweenDioceses() {
        Diocese otherDiocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Other Diocese")
                .code("OD")
                .description("Other")
                .build());
        Parish otherParish = parishRepository.save(Parish.builder()
                .parishName("Other Parish")
                .diocese(otherDiocese)
                .description("Other")
                .build());

        baptismRepository.save(createBaptism(parish1));
        baptismRepository.save(createBaptism(otherParish));

        DioceseDashboardResponse result = dioceseDashboardService.getDioceseDashboard(diocese.getId());

        assertThat(result.getCounts().get("baptisms")).isEqualTo(1L);
        assertThat(result.getParishActivity()).hasSize(2);
        assertThat(result.getParishActivity().stream()
                .filter(p -> "Integration Parish 1".equals(p.getParishName()))
                .findFirst())
                .isPresent()
                .get()
                .extracting(DioceseDashboardResponse.ParishActivityItem::getBaptisms)
                .isEqualTo(1L);
    }

    private static Baptism createBaptism(Parish p) {
        return Baptism.builder()
                .baptismName("Test")
                .surname("User")
                .otherNames("")
                .gender("M")
                .dateOfBirth(LocalDate.of(2015, 1, 1))
                .fathersName("Father")
                .mothersName("Mother")
                .sponsorNames("Sponsor")
                .officiatingPriest("Fr. X")
                .parish(p)
                .address("")
                .parishAddress("")
                .parentAddress("")
                .build();
    }
}
