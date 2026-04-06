package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.ConfirmationRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.HolyOrderRepository;
import com.wyloks.churchRegistry.repository.MarriageRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SacramentAuthorizationServiceTest {

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
    ParishRepository parishRepository;

    SacramentAuthorizationService service;

    @BeforeEach
    void setUp() {
        service = new SacramentAuthorizationService(
                baptismRepository,
                communionRepository,
                confirmationRepository,
                marriageRepository,
                holyOrderRepository,
                parishRepository
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requireDioceseAccess_admin_allowsAccess_whenAssignedParishInDiocese() {
        setCurrentUser("ADMIN", Set.of(10L));
        when(parishRepository.findByIdInAndDioceseId(anySet(), eq(1L)))
                .thenReturn(List.of(Parish.builder().id(10L).build()));

        assertThatCode(() -> service.requireDioceseAccess(1L))
                .doesNotThrowAnyException();
    }

    @Test
    void requireDioceseAccess_admin_denied_whenNoParishInDiocese() {
        setCurrentUser("ADMIN", Set.of(10L));
        when(parishRepository.findByIdInAndDioceseId(anySet(), eq(1L)))
                .thenReturn(Collections.emptyList());

        assertThatThrownBy(() -> service.requireDioceseAccess(1L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("No assigned parish in this diocese");
                });
    }

    @Test
    void requireDioceseAccess_superAdmin_allowsAccess() {
        setCurrentUser("SUPER_ADMIN");

        assertThatCode(() -> service.requireDioceseAccess(1L))
                .doesNotThrowAnyException();
    }

    @Test
    void requireDioceseAccess_parishPriest_throwsForbidden() {
        setCurrentUser("PARISH_PRIEST");

        assertThatThrownBy(() -> service.requireDioceseAccess(1L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("Diocese access denied");
                });
    }

    @Test
    void requireDioceseAccess_parishViewer_throwsForbidden() {
        setCurrentUser("PARISH_VIEWER");

        assertThatThrownBy(() -> service.requireDioceseAccess(1L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                });
    }

    @Test
    void requireParishAccess_admin_deniedOutsideAssignedParishes() {
        setCurrentUser("ADMIN", Set.of(10L));

        assertThatThrownBy(() -> service.requireParishAccess(99L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                });
    }

    @Test
    void requireParishAccess_admin_allowedInsideAssignedParishes() {
        setCurrentUser("ADMIN", Set.of(10L));

        assertThatCode(() -> service.requireParishAccess(10L))
                .doesNotThrowAnyException();
    }

    @Test
    void requireParishAccess_superAdmin_allowsWithoutParishAssignment() {
        setCurrentUser("SUPER_ADMIN", Collections.emptySet());

        assertThatCode(() -> service.requireParishAccess(999L))
                .doesNotThrowAnyException();
    }

    @Test
    void requireWriteAccessForParish_admin_deniedOutsideAssignedParishes() {
        setCurrentUser("ADMIN", Set.of(10L));

        assertThatThrownBy(() -> service.requireWriteAccessForParish(99L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                });
    }

    @Test
    void requireDioceseAccess_nullDioceseId_throwsForbidden() {
        setCurrentUser("ADMIN", Set.of(1L));

        assertThatThrownBy(() -> service.requireDioceseAccess(null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("Diocese ID is required");
                });
    }

    @Test
    void requireReadAccessForBaptism_parishPriest_deniedWhenParishUnresolved() {
        setCurrentUser("PARISH_PRIEST", Set.of(10L));
        when(baptismRepository.existsById(50L)).thenReturn(true);
        when(baptismRepository.findParishIdById(50L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireReadAccessForBaptism(50L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("no parish assignment");
                });
    }

    @Test
    void requireReadAccessForBaptism_superAdmin_allowsWhenParishUnresolved() {
        setCurrentUser("SUPER_ADMIN", Collections.emptySet());
        when(baptismRepository.existsById(50L)).thenReturn(true);
        when(baptismRepository.findParishIdById(50L)).thenReturn(Optional.empty());

        assertThat(service.requireReadAccessForBaptism(50L)).isTrue();
    }

    @Test
    void requireReadAccessForBaptism_returnsFalseWhenMissing() {
        setCurrentUser("PARISH_PRIEST", Set.of(10L));
        when(baptismRepository.existsById(999L)).thenReturn(false);

        assertThat(service.requireReadAccessForBaptism(999L)).isFalse();
    }

    @Test
    void requireWriteAccessForBaptism_admin_deniedWhenParishUnresolved() {
        setCurrentUser("ADMIN", Set.of(10L));
        when(baptismRepository.existsById(51L)).thenReturn(true);
        when(baptismRepository.findParishIdById(51L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireWriteAccessForBaptism(51L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(rse.getReason()).contains("no parish assignment");
                });
    }

    private void setCurrentUser(String role) {
        setCurrentUser(role, Collections.emptySet());
    }

    private void setCurrentUser(String role, Set<Long> parishAccessIds) {
        Set<Parish> accesses = parishAccessIds.stream()
                .map(id -> Parish.builder().id(id).build())
                .collect(Collectors.toSet());
        AppUser user = AppUser.builder()
                .username("testuser")
                .passwordHash("hash")
                .role(role)
                .parish(null)
                .parishAccesses(accesses)
                .build();
        AppUserDetails userDetails = new AppUserDetails(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
