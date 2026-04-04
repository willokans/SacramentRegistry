package com.wyloks.churchRegistry.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;

@Component
@Profile("prod")
public class ProductionInvitationEmailPolicyValidator {

    private final String smtpUsername;
    private final String invitationFromAddress;
    private final String allowedDomain;

    public ProductionInvitationEmailPolicyValidator(
            @Value("${spring.mail.username}") String smtpUsername,
            @Value("${app.invitation.email.from}") String invitationFromAddress,
            @Value("${app.invitation.email.allowed-domain:sacramentregistry.com}") String allowedDomain) {
        this.smtpUsername = smtpUsername;
        this.invitationFromAddress = invitationFromAddress;
        this.allowedDomain = allowedDomain;
    }

    @PostConstruct
    void validateEmailPolicy() {
        String normalizedAllowedDomain = normalizeAllowedDomain(allowedDomain);
        validateMailbox("spring.mail.username", smtpUsername, normalizedAllowedDomain);
        validateMailbox("app.invitation.email.from", invitationFromAddress, normalizedAllowedDomain);
    }

    private void validateMailbox(String propertyName, String mailboxValue, String normalizedAllowedDomain) {
        if (!StringUtils.hasText(mailboxValue)) {
            throw new IllegalStateException(propertyName + " must be configured in production");
        }

        String email = extractEmailAddress(mailboxValue);
        int atIndex = email.lastIndexOf('@');
        if (atIndex <= 0 || atIndex == email.length() - 1) {
            throw new IllegalStateException(propertyName + " must be a valid mailbox address");
        }

        String domain = email.substring(atIndex + 1).toLowerCase(Locale.ROOT);
        if (!domain.equals(normalizedAllowedDomain)) {
            throw new IllegalStateException(
                    propertyName + " must use approved domain '" + normalizedAllowedDomain + "'");
        }
    }

    private String normalizeAllowedDomain(String domain) {
        if (!StringUtils.hasText(domain)) {
            throw new IllegalStateException("app.invitation.email.allowed-domain must be configured in production");
        }
        return domain.trim().toLowerCase(Locale.ROOT);
    }

    private String extractEmailAddress(String rawValue) {
        String trimmed = rawValue.trim();
        int openBracket = trimmed.indexOf('<');
        int closeBracket = trimmed.indexOf('>');
        if (openBracket >= 0 && closeBracket > openBracket) {
            return trimmed.substring(openBracket + 1, closeBracket).trim();
        }
        return trimmed;
    }
}
