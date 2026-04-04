package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.service.impl.InvitationEmailServiceImpl;
import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Set;

@ExtendWith(MockitoExtension.class)
class InvitationEmailServiceImplTest {

    @Mock
    JavaMailSender mailSender;

    InvitationEmailServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new InvitationEmailServiceImpl(mailSender);
        ReflectionTestUtils.setField(service, "invitationAcceptBaseUrl", "https://app.example.com/accept-invite");
        ReflectionTestUtils.setField(service, "fromAddress", "onboarding@sacramentregistry.com");
        ReflectionTestUtils.setField(service, "supportAddress", "support@sacramentregistry.com");
    }

    @Test
    void sendInvitationEmail_sendsMultipartEmailWithTemplateVariables() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        Parish parish = Parish.builder().parishName("St Peter Parish").build();
        AppUser invitedUser = AppUser.builder()
                .email("invitee@example.com")
                .firstName("Peter")
                .role("PRIEST")
                .parish(parish)
                .build();
        AppUser inviter = AppUser.builder()
                .displayName("Fr. Michael Admin")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .appUser(invitedUser)
                .createdByUser(inviter)
                .invitedEmail("invitee@example.com")
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .expiresAt(Instant.parse("2026-01-08T00:00:00Z"))
                .build();

        service.sendInvitationEmail(invitation, "test-token-123");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        MimeMessage sent = captor.getValue();
        Address[] from = sent.getFrom();
        Address[] recipients = sent.getRecipients(Message.RecipientType.TO);
        assertThat(from).isNotNull();
        assertThat(from[0].toString()).isEqualTo("onboarding@sacramentregistry.com");
        assertThat(recipients).isNotNull();
        assertThat(recipients[0].toString()).isEqualTo("invitee@example.com");
        assertThat(sent.getSubject()).isEqualTo("You've been invited to Sacrament Registry");

        Multipart multipart = (Multipart) sent.getContent();
        String allText = extractText(multipart);

        assertThat(allText).contains("Hello Peter,");
        assertThat(allText).contains("St Peter Parish", "Fr. Michael Admin", "Priest");
        assertThat(allText).contains("This invitation link expires in 7 days.");
        assertThat(allText).contains("support@sacramentregistry.com");
        assertThat(allText).contains("Sacrament Registry");
        assertThat(allText).contains("https://app.example.com/accept-invite?token=test-token-123");
    }

    @Test
    void sendInvitationEmail_listsAllAssignedParishes() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        Parish first = Parish.builder().parishName("St Martin's Catholic Church, Mabushi - Abuja Nigeria").build();
        Parish second = Parish.builder().parishName("Holy Family Catholic Church").build();
        AppUser invitedUser = AppUser.builder()
                .email("invitee@example.com")
                .firstName("Michael")
                .role("PARISH_SECRETARY")
                .parishAccesses(Set.of(first, second))
                .build();
        AppUser inviter = AppUser.builder()
                .displayName("Super Administrator")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .appUser(invitedUser)
                .createdByUser(inviter)
                .invitedEmail("invitee@example.com")
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .expiresAt(Instant.parse("2026-01-08T00:00:00Z"))
                .build();

        service.sendInvitationEmail(invitation, "token-xyz");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        Multipart multipart = (Multipart) captor.getValue().getContent();
        String allText = extractText(multipart);
        assertThat(allText).contains("Hello Michael,");
        assertThat(allText).contains("You have been invited to join Sacrament Registry for");
        assertThat(allText).contains("St Martin's Catholic Church, Mabushi - Abuja Nigeria.");
        assertThat(allText).contains("Holy Family Catholic Church.");
        assertThat(allText).contains("Assigned role: Parish Secretary");
    }

    @Test
    void sendInvitationEmail_usesGenericGreetingAndFallsBackToDefaultParish() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        Parish defaultParish = Parish.builder().parishName("St Jude Catholic Church").build();
        AppUser invitedUser = AppUser.builder()
                .email("invitee@example.com")
                .role("PARISH_VIEWER")
                .parish(defaultParish)
                .build();
        AppUser inviter = AppUser.builder()
                .displayName("Super Administrator")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .appUser(invitedUser)
                .createdByUser(inviter)
                .invitedEmail("invitee@example.com")
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .expiresAt(Instant.parse("2026-01-08T00:00:00Z"))
                .build();

        service.sendInvitationEmail(invitation, "token-abc");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        Multipart multipart = (Multipart) captor.getValue().getContent();
        String allText = extractText(multipart);
        assertThat(allText).contains("Hello,");
        assertThat(allText).contains("St Jude Catholic Church.");
        assertThat(allText).contains("Assigned role: Parish Viewer");
    }

    @Test
    void sendInvitationEmail_fallsBackToInviterUsernameWhenDisplayNameMissing() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        AppUser invitedUser = AppUser.builder()
                .email("invitee@example.com")
                .role("PRIEST")
                .build();
        AppUser inviter = AppUser.builder()
                .username("admin.user")
                .build();
        UserInvitation invitation = UserInvitation.builder()
                .appUser(invitedUser)
                .createdByUser(inviter)
                .invitedEmail("invitee@example.com")
                .build();

        service.sendInvitationEmail(invitation, "abc-token");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        Multipart multipart = (Multipart) captor.getValue().getContent();
        String allText = extractText(multipart);
        assertThat(allText).contains("admin.user");
    }

    @Test
    void sendInvitationEmail_throwsWhenTokenBlank() {
        AppUser invitedUser = AppUser.builder().email("invitee@example.com").build();
        UserInvitation invitation = UserInvitation.builder()
                .appUser(invitedUser)
                .invitedEmail("invitee@example.com")
                .build();

        assertThatThrownBy(() -> service.sendInvitationEmail(invitation, " "))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invitation token is required");
    }

    private String extractText(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof Multipart multipart) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                sb.append(extractText(multipart.getBodyPart(i).getContent())).append("\n");
            }
            return sb.toString();
        }
        return String.valueOf(content);
    }
}
