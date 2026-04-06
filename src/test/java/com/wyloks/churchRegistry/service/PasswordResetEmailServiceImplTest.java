package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.service.impl.PasswordResetEmailServiceImpl;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetEmailServiceImplTest {

    @Mock
    JavaMailSender mailSender;

    PasswordResetEmailServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetEmailServiceImpl(mailSender);
        ReflectionTestUtils.setField(service, "publicBaseUrl", "https://app.example.com");
        ReflectionTestUtils.setField(service, "fromAddress", "onboarding@sacramentregistry.com");
        ReflectionTestUtils.setField(service, "supportAddress", "support@sacramentregistry.com");
    }

    @Test
    void sendPasswordResetEmail_sendsEmailWithResetLinkContainingTokenQuery() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendPasswordResetEmail("user@example.com", "reset-token-abc", null);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        MimeMessage sent = captor.getValue();
        Address[] from = sent.getFrom();
        Address[] recipients = sent.getRecipients(Message.RecipientType.TO);
        assertThat(from).isNotNull();
        assertThat(from[0].toString()).isEqualTo("onboarding@sacramentregistry.com");
        assertThat(recipients).isNotNull();
        assertThat(recipients[0].toString()).isEqualTo("user@example.com");
        assertThat(sent.getSubject()).isEqualTo("Reset your Sacrament Registry password");

        Multipart multipart = (Multipart) sent.getContent();
        String allText = extractText(multipart);
        assertThat(allText).contains("https://app.example.com/reset-password?token=reset-token-abc");
        assertThat(allText).contains("Hello,");
        assertThat(allText).contains("Reset your password");
        assertThat(allText).contains("Sacrament Registry");
        assertThat(allText).contains("Secure sacramental record management for Catholic parishes");
        assertThat(allText).contains("support@sacramentregistry.com");
        assertThat(allText).doesNotContain("St. Mary");
    }

    @Test
    void sendPasswordResetEmail_includesParishContextWhenProvided() throws Exception {
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendPasswordResetEmail("user@example.com", "tok", "St. Mary Parish");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        Multipart multipart = (Multipart) captor.getValue().getContent();
        String allText = extractText(multipart);
        assertThat(allText).contains("St. Mary Parish");
        assertThat(allText).contains("associated with");
    }

    @Test
    void sendPasswordResetEmail_stripsTrailingSlashOnPublicBaseUrl() throws Exception {
        ReflectionTestUtils.setField(service, "publicBaseUrl", "https://app.example.com/");
        MimeMessage mimeMessage = new MimeMessage((jakarta.mail.Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.sendPasswordResetEmail("user@example.com", "tok", null);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        Multipart multipart = (Multipart) captor.getValue().getContent();
        assertThat(extractText(multipart)).contains("https://app.example.com/reset-password?token=tok");
    }

    @Test
    void sendPasswordResetEmail_throwsWhenTokenBlank() {
        assertThatThrownBy(() -> service.sendPasswordResetEmail("user@example.com", " ", null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Password reset token is required");
    }

    @Test
    void sendPasswordResetEmail_throwsWhenRecipientBlank() {
        assertThatThrownBy(() -> service.sendPasswordResetEmail(" ", "token", null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Recipient email is required");
    }

    @Test
    void sendPasswordResetEmail_throwsWhenMailSenderMissing() {
        PasswordResetEmailServiceImpl noSender = new PasswordResetEmailServiceImpl();
        ReflectionTestUtils.setField(noSender, "mailSender", null);
        ReflectionTestUtils.setField(noSender, "publicBaseUrl", "https://app.example.com");
        ReflectionTestUtils.setField(noSender, "fromAddress", "onboarding@sacramentregistry.com");
        ReflectionTestUtils.setField(noSender, "supportAddress", "support@sacramentregistry.com");

        assertThatThrownBy(() -> noSender.sendPasswordResetEmail("user@example.com", "t", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not configured");
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
