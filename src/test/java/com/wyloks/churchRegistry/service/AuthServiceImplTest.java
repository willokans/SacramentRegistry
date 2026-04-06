package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.PasswordResetToken;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.PasswordResetTokenRepository;
import com.wyloks.churchRegistry.repository.RefreshTokenRepository;
import com.wyloks.churchRegistry.security.JwtService;
import com.wyloks.churchRegistry.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    AppUserRepository appUserRepository;

    @Mock
    RefreshTokenRepository refreshTokenRepository;

    @Mock
    PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    JwtService jwtService;

    @Mock
    UserInvitationService userInvitationService;

    @Mock
    PasswordResetEmailService passwordResetEmailService;

    @InjectMocks
    AuthServiceImpl authService;

    @BeforeEach
    void setExpirationDefaults() {
        ReflectionTestUtils.setField(authService, "passwordResetTokenExpirationMs", 3_600_000L);
        ReflectionTestUtils.setField(authService, "refreshExpirationMs", 604_800_000L);
    }

    @Test
    void forgotPassword_whenIdentifierBlank_throwsBadRequest() {
        assertThatThrownBy(() -> authService.forgotPassword("  "))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(passwordResetEmailService);
        verify(passwordResetTokenRepository, never()).save(any());
    }

    @Test
    void forgotPassword_whenNoMatchingUser_returnsGenericMessage_andDoesNotSendEmail() {
        when(appUserRepository.findByUsernameIgnoreCase("unknown")).thenReturn(Optional.empty());
        when(appUserRepository.findByEmailIgnoreCase("unknown")).thenReturn(Optional.empty());

        ForgotPasswordResponse res = authService.forgotPassword("unknown");

        assertThat(res.getMessage()).isEqualTo(ForgotPasswordResponse.MESSAGE);
        verifyNoInteractions(passwordResetEmailService);
        verify(passwordResetTokenRepository, never()).save(any());
    }

    @Test
    void forgotPassword_whenUserHasNoEmail_returnsGenericMessage_andDoesNotSendEmail() {
        AppUser user = AppUser.builder().id(1L).username("nemail").email(null).build();
        when(appUserRepository.findByUsernameIgnoreCase("nemail")).thenReturn(Optional.of(user));

        ForgotPasswordResponse res = authService.forgotPassword("nemail");

        assertThat(res.getMessage()).isEqualTo(ForgotPasswordResponse.MESSAGE);
        verifyNoInteractions(passwordResetEmailService);
        verify(passwordResetTokenRepository, never()).save(any());
    }

    @Test
    void forgotPassword_whenUserHasEmail_savesToken_andSendsEmailWithNullParishWhenNoParish() {
        AppUser user = AppUser.builder().id(2L).username("alice").email("alice@example.com").parish(null).build();
        when(appUserRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(user));

        ForgotPasswordResponse res = authService.forgotPassword("alice");

        assertThat(res.getMessage()).isEqualTo(ForgotPasswordResponse.MESSAGE);
        verify(passwordResetTokenRepository).deleteByUser(user);
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
        verify(passwordResetEmailService).sendPasswordResetEmail(eq("alice@example.com"), anyString(), isNull());
    }

    @Test
    void forgotPassword_whenUserHasPrimaryParish_passesParishNameToEmailService() {
        Parish parish = Parish.builder().id(9L).parishName("St. Mary Parish").build();
        AppUser user = AppUser.builder().id(3L).username("bob").email("bob@example.com").parish(parish).build();
        when(appUserRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(user));

        authService.forgotPassword("bob");

        verify(passwordResetEmailService).sendPasswordResetEmail(eq("bob@example.com"), anyString(), eq("St. Mary Parish"));
    }

    @Test
    void forgotPassword_whenEmailSendFails_deletesPersistedToken() {
        AppUser user = AppUser.builder().id(4L).username("carol").email("carol@example.com").build();
        when(appUserRepository.findByUsernameIgnoreCase("carol")).thenReturn(Optional.of(user));
        doThrow(new IllegalStateException("mail down"))
                .when(passwordResetEmailService)
                .sendPasswordResetEmail(anyString(), anyString(), any());

        ForgotPasswordResponse res = authService.forgotPassword("carol");

        assertThat(res.getMessage()).isEqualTo(ForgotPasswordResponse.MESSAGE);
        ArgumentCaptor<PasswordResetToken> tokenCaptor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(passwordResetTokenRepository).save(tokenCaptor.capture());
        verify(passwordResetTokenRepository).delete(tokenCaptor.getValue());
    }
}
