package com.wyloks.churchRegistry.config;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Avoids real SMTP during integration tests; {@link com.wyloks.churchRegistry.service.impl.AuthServiceImpl}
 * only keeps a password reset token when email send succeeds.
 */
@TestConfiguration
public class IntegrationTestMailConfig {

    @Bean
    @Primary
    public JavaMailSender javaMailSender() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        Session session = Session.getInstance(new Properties());
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(session));
        doNothing().when(sender).send(any(MimeMessage.class));
        return sender;
    }
}
