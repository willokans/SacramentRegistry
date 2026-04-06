package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.entity.UserInvitationEmailDeliveryStatus;
import com.wyloks.churchRegistry.entity.UserInvitationStatus;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.UserInvitationRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.impl.UserInvitationServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserInvitationServiceImplTest {

    @Mock
    UserInvitationRepository userInvitationRepository;

    @Mock
    AppUserRepository appUserRepository;

    @Mock
    CurrentUserAccessService currentUserAccessService;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    InvitationEmailService invitationEmailService;

    @InjectMocks
    UserInvitationServiceImpl service;

    private void setExposeTokenInResponse(boolean enabled) {
        ReflectionTestUtils.setField(service, "exposeTokenInResponse", enabled);
    }

    private void setResendCooldownMs(long cooldownMs) {
        ReflectionTestUtils.setField(service, "resendCooldownMs", cooldownMs);
    }

    @Test
    void getLatestInvitationForUser_returnsLatestInvitationMetadata() {
        AppUser target = AppUser.builder()
                .id(99L)
                .email("invitee@example.com")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .id(901L)
                .appUser(target)
                .invitedEmail("invitee@example.com")
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED)
                .expiresAt(Instant.now().plusSeconds(3600))
                .lastEmailAttemptAt(Instant.now().minusSeconds(30))
                .lastEmailError("Authentication failed")
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findWithParishAccessesById(99L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findFirstByAppUserIdOrderByCreatedAtDescIdDesc(99L))
                .thenReturn(Optional.of(invitation));

        var response = service.getLatestInvitationForUser(99L);

        assertThat(response.getInvitationId()).isEqualTo(901L);
        assertThat(response.getUserId()).isEqualTo(99L);
        assertThat(response.getInvitationStatus()).isEqualTo(UserInvitationStatus.PENDING);
        assertThat(response.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.FAILED);
        assertThat(response.getLastEmailError()).isEqualTo("Authentication failed");
        assertThat(response.getToken()).isNull();
    }

    @Test
    void getLatestInvitationForUser_returns404WhenNoneExists() {
        AppUser existing = AppUser.builder()
                .id(404L)
                .username("ghost")
                .email("ghost@example.com")
                .build();
        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findWithParishAccessesById(404L)).thenReturn(Optional.of(existing));
        when(userInvitationRepository.findFirstByAppUserIdOrderByCreatedAtDescIdDesc(404L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getLatestInvitationForUser(404L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException responseStatusException = (ResponseStatusException) ex;
                    assertThat(responseStatusException.getStatusCode().value()).isEqualTo(404);
                });
    }

    @Test
    void getInvitationProfile_returnsPrefillFieldsForActiveInvite() {
        AppUser invited = AppUser.builder()
                .id(20L)
                .title("Fr.")
                .firstName("James")
                .lastName("Peter")
                .email("james@example.com")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .id(201L)
                .appUser(invited)
                .invitedEmail("james@example.com")
                .status(UserInvitationStatus.PENDING)
                .tokenHash("hashed-token")
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        when(userInvitationRepository.findByStatusAndExpiresAtBefore(org.mockito.ArgumentMatchers.eq(UserInvitationStatus.PENDING), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
        when(userInvitationRepository.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(Optional.of(invitation));

        var response = service.getInvitationProfile("raw-token");

        assertThat(response.getTitle()).isEqualTo("Fr.");
        assertThat(response.getFirstName()).isEqualTo("James");
        assertThat(response.getLastName()).isEqualTo("Peter");
        assertThat(response.getInvitedEmail()).isEqualTo("james@example.com");
        assertThat(response.getExpiresAt()).isEqualTo(invitation.getExpiresAt());
    }

    @Test
    void issueInvitation_initializesEmailDeliveryTrackingToPending() {
        setExposeTokenInResponse(false);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(10L)
                .username("priest.one")
                .email("priest.one@example.com")
                .mustResetPassword(false)
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(appUserRepository.findWithParishAccessesById(10L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findByAppUserIdAndStatus(10L, UserInvitationStatus.PENDING))
                .thenReturn(List.of());
        when(userInvitationRepository.save(any(UserInvitation.class))).thenAnswer(invocation -> {
            UserInvitation invitation = invocation.getArgument(0);
            invitation.setId(55L);
            return invitation;
        });
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.issueInvitation(10L);

        ArgumentCaptor<UserInvitation> invitationCaptor = ArgumentCaptor.forClass(UserInvitation.class);
        verify(userInvitationRepository, times(2)).save(invitationCaptor.capture());
        UserInvitation saved = invitationCaptor.getAllValues().get(1);
        assertThat(saved.getStatus()).isEqualTo(UserInvitationStatus.PENDING);
        assertThat(saved.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.SENT);
        assertThat(saved.getEmailSentAt()).isNotNull();
        assertThat(saved.getLastEmailAttemptAt()).isNotNull();
        assertThat(saved.getLastEmailError()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void issueInvitation_revokingOlderPendingInvitesDoesNotChangeDeliveryStatus() {
        setExposeTokenInResponse(false);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(20L)
                .username("priest.two")
                .email("priest.two@example.com")
                .build();
        UserInvitation existingPending = UserInvitation.builder()
                .id(100L)
                .appUser(target)
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED)
                .createdAt(Instant.now().minusSeconds(3600))
                .updatedAt(Instant.now().minusSeconds(3600))
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(appUserRepository.findWithParishAccessesById(20L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findByAppUserIdAndStatus(20L, UserInvitationStatus.PENDING))
                .thenReturn(List.of(existingPending));
        when(userInvitationRepository.save(any(UserInvitation.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userInvitationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.issueInvitation(20L);

        ArgumentCaptor<List<UserInvitation>> revokedCaptor = ArgumentCaptor.forClass(List.class);
        verify(userInvitationRepository).saveAll(revokedCaptor.capture());
        UserInvitation revoked = revokedCaptor.getValue().get(0);
        assertThat(revoked.getStatus()).isEqualTo(UserInvitationStatus.REVOKED);
        assertThat(revoked.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.FAILED);
    }

    @Test
    void issueInvitation_keepsInvitationPendingAndMarksDeliveryFailedWhenEmailSendFails() {
        setExposeTokenInResponse(false);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(30L)
                .username("priest.three")
                .email("priest.three@example.com")
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(appUserRepository.findWithParishAccessesById(30L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findByAppUserIdAndStatus(30L, UserInvitationStatus.PENDING))
                .thenReturn(List.of());
        when(userInvitationRepository.save(any(UserInvitation.class))).thenAnswer(invocation -> {
            UserInvitation invitation = invocation.getArgument(0);
            if (invitation.getId() == null) {
                invitation.setId(77L);
            }
            return invitation;
        });
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("smtp timeout\r\nsensitive details"))
                .when(invitationEmailService)
                .sendInvitationEmail(any(UserInvitation.class), any(String.class));

        var response = service.issueInvitation(30L);

        ArgumentCaptor<UserInvitation> invitationCaptor = ArgumentCaptor.forClass(UserInvitation.class);
        verify(userInvitationRepository, times(2)).save(invitationCaptor.capture());
        UserInvitation saved = invitationCaptor.getAllValues().get(1);
        assertThat(saved.getStatus()).isEqualTo(UserInvitationStatus.PENDING);
        assertThat(saved.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.FAILED);
        assertThat(saved.getLastEmailAttemptAt()).isNotNull();
        assertThat(saved.getEmailSentAt()).isNull();
        assertThat(saved.getLastEmailError()).contains("smtp timeout").doesNotContain("\n").doesNotContain("\r");

        assertThat(response.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.FAILED);
        assertThat(response.getDeliveryMessage()).contains("Please use resend to try again");
        assertThat(response.getToken()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void resendInvitation_createsNewPendingInvitationAndSendsEmail() {
        setExposeTokenInResponse(false);
        setResendCooldownMs(900_000L);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(40L)
                .username("priest.four")
                .email("priest.four@example.com")
                .build();
        UserInvitation priorInvitation = UserInvitation.builder()
                .id(400L)
                .appUser(target)
                .invitedEmail("priest.four@example.com")
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED)
                .lastEmailAttemptAt(Instant.now().minusSeconds(3600))
                .build();
        UserInvitation existingPending = UserInvitation.builder()
                .id(401L)
                .appUser(target)
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED)
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(userInvitationRepository.findById(400L)).thenReturn(Optional.of(priorInvitation));
        when(appUserRepository.findWithParishAccessesById(40L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findByAppUserIdAndStatus(40L, UserInvitationStatus.PENDING))
                .thenReturn(List.of(existingPending));
        when(userInvitationRepository.save(any(UserInvitation.class))).thenAnswer(invocation -> {
            UserInvitation invitation = invocation.getArgument(0);
            if (invitation.getId() == null) {
                invitation.setId(402L);
            }
            return invitation;
        });
        when(userInvitationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doNothing().when(invitationEmailService).sendInvitationEmail(any(UserInvitation.class), any(String.class));

        var response = service.resendInvitation(400L);

        ArgumentCaptor<List<UserInvitation>> revokedCaptor = ArgumentCaptor.forClass(List.class);
        verify(userInvitationRepository).saveAll(revokedCaptor.capture());
        assertThat(revokedCaptor.getValue().get(0).getStatus()).isEqualTo(UserInvitationStatus.REVOKED);
        assertThat(response.getInvitationId()).isEqualTo(402L);
        assertThat(response.getEmailDeliveryStatus()).isEqualTo(UserInvitationEmailDeliveryStatus.SENT);
        assertThat(response.getDeliveryMessage()).isEqualTo("Invitation email sent.");
        assertThat(response.getToken()).isNull();
    }

    @Test
    void resendInvitation_deniesWhenWithinCooldownAndReturnsWaitFeedback() {
        setExposeTokenInResponse(false);
        setResendCooldownMs(900_000L);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(41L)
                .username("priest.cooldown")
                .email("priest.cooldown@example.com")
                .build();
        UserInvitation priorInvitation = UserInvitation.builder()
                .id(410L)
                .appUser(target)
                .invitedEmail("priest.cooldown@example.com")
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED)
                .lastEmailAttemptAt(Instant.now().minusSeconds(120))
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(userInvitationRepository.findById(410L)).thenReturn(Optional.of(priorInvitation));
        when(appUserRepository.findWithParishAccessesById(41L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.resendInvitation(410L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException responseStatusException = (ResponseStatusException) ex;
                    assertThat(responseStatusException.getStatusCode().value()).isEqualTo(400);
                    assertThat(responseStatusException.getReason()).contains("Resend allowed in");
                    assertThat(responseStatusException.getReason()).contains("Please try again later.");
                });
    }

    @Test
    void issueInvitation_canExposeRawTokenWhenExplicitlyEnabledForLocalDev() {
        setExposeTokenInResponse(true);
        AppUser admin = AppUser.builder()
                .id(1L)
                .username("admin")
                .build();
        AppUser target = AppUser.builder()
                .id(50L)
                .username("priest.five")
                .email("priest.five@example.com")
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("admin", "SUPER_ADMIN", Set.of()));
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(appUserRepository.findWithParishAccessesById(50L)).thenReturn(Optional.of(target));
        when(userInvitationRepository.findByAppUserIdAndStatus(50L, UserInvitationStatus.PENDING))
                .thenReturn(List.of());
        when(userInvitationRepository.save(any(UserInvitation.class))).thenAnswer(invocation -> {
            UserInvitation invitation = invocation.getArgument(0);
            if (invitation.getId() == null) {
                invitation.setId(78L);
            }
            return invitation;
        });
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.issueInvitation(50L);

        assertThat(response.getToken()).isNotBlank();
    }

    @Test
    void issueInvitation_whenParishScopedAdmin_noParishOverlap_returns404() {
        AppUser actor = AppUser.builder().id(1L).username("parishAdmin").build();
        Parish foreignParish = Parish.builder().id(200L).build();
        AppUser target = AppUser.builder()
                .id(99L)
                .username("foreign")
                .email("foreign@example.com")
                .parishAccesses(Set.of(foreignParish))
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("parishAdmin", "ADMIN", Set.of(100L)));
        when(appUserRepository.findByUsername("parishAdmin")).thenReturn(Optional.of(actor));
        when(appUserRepository.findWithParishAccessesById(99L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.issueInvitation(99L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException r = (ResponseStatusException) ex;
                    assertThat(r.getStatusCode().value()).isEqualTo(404);
                    assertThat(r.getReason()).isEqualTo("User not found: 99");
                });
    }

    @Test
    void getLatestInvitationForUser_whenParishScopedAdmin_noParishOverlap_returns404() {
        Parish foreignParish = Parish.builder().id(200L).build();
        AppUser target = AppUser.builder()
                .id(88L)
                .username("other")
                .email("other@example.com")
                .parishAccesses(Set.of(foreignParish))
                .build();

        when(currentUserAccessService.currentUser())
                .thenReturn(new CurrentUserAccessService.CurrentUserAccess("parishAdmin", "ADMIN", Set.of(100L)));
        when(appUserRepository.findWithParishAccessesById(88L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.getLatestInvitationForUser(88L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException r = (ResponseStatusException) ex;
                    assertThat(r.getStatusCode().value()).isEqualTo(404);
                    assertThat(r.getReason()).isEqualTo("User not found: 88");
                });
    }
}
