package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.service.InvitationEmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class InvitationEmailServiceImpl implements InvitationEmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public InvitationEmailServiceImpl() {
        // Spring default constructor
    }

    public InvitationEmailServiceImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Value("${app.invitation.accept-base-url:http://localhost:3000/accept-invite}")
    private String invitationAcceptBaseUrl;

    @Value("${app.invitation.email.from:onboarding@sacramentregistry.com}")
    private String fromAddress;

    @Value("${app.invitation.email.support:support@sacramentregistry.com}")
    private String supportAddress;

    @Override
    public void sendInvitationEmail(UserInvitation invitation, String rawToken) {
        if (invitation == null || invitation.getAppUser() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation is required to send email");
        }
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation token is required");
        }

        String recipient = normalizeRecipient(invitation.getInvitedEmail());
        String acceptUrl = buildAcceptUrl(rawToken);

        AppUser invitedUser = invitation.getAppUser();
        AppUser inviter = invitation.getCreatedByUser();
        String greetingName = safeText(invitedUser.getFirstName());
        List<String> parishNames = resolveParishNames(invitedUser);
        String inviterName = buildInviterName(inviter);
        String assignedRole = humanizeRole(invitedUser.getRole());
        String expiryText = buildExpiryText(invitation.getExpiresAt(), invitation.getCreatedAt());

        String subject = "You've been invited to Sacrament Registry";
        String plainTextBody = buildPlainTextBody(greetingName, parishNames, inviterName, assignedRole, acceptUrl, expiryText);
        String htmlBody = buildHtmlBody(greetingName, parishNames, inviterName, assignedRole, acceptUrl, expiryText);

        try {
            JavaMailSender resolvedMailSender = resolveMailSender();
            MimeMessage message = resolvedMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(sanitizeHeaderValue(fromAddress));
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(plainTextBody, htmlBody);
            resolvedMailSender.send(message);
        } catch (MessagingException ex) {
            throw new IllegalStateException("Failed to construct invitation email message", ex);
        }
    }

    private JavaMailSender resolveMailSender() {
        if (mailSender == null) {
            throw new IllegalStateException("Invitation email delivery is not configured");
        }
        return mailSender;
    }

    private String buildAcceptUrl(String rawToken) {
        return UriComponentsBuilder.fromUriString(invitationAcceptBaseUrl)
                .queryParam("token", rawToken.trim())
                .build()
                .toUriString();
    }

    private String normalizeRecipient(String invitedEmail) {
        if (invitedEmail == null || invitedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation recipient email is required");
        }
        return invitedEmail.trim();
    }

    private String buildInviterName(AppUser inviter) {
        if (inviter == null) {
            return "an administrator";
        }
        String displayName = safeText(inviter.getDisplayName());
        if (!displayName.isBlank()) {
            return displayName;
        }
        String firstName = safeText(inviter.getFirstName());
        String lastName = safeText(inviter.getLastName());
        String combined = (firstName + " " + lastName).trim();
        if (!combined.isBlank()) {
            return combined;
        }
        String username = safeText(inviter.getUsername());
        return username.isBlank() ? "an administrator" : username;
    }

    private String buildPlainTextBody(
            String greetingName,
            List<String> parishNames,
            String inviterName,
            String assignedRole,
            String acceptUrl,
            String expiryText
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(buildGreeting(greetingName)).append("\n\n");
        sb.append("You have been invited to join Sacrament Registry for").append("\n");
        appendPlainParishList(sb, parishNames);
        sb.append("Invited by: ").append(inviterName).append("\n");
        if (!assignedRole.isBlank()) {
            sb.append("Assigned role: ").append(assignedRole).append("\n");
        }
        if (!expiryText.isBlank()) {
            sb.append(expiryText).append("\n");
        }
        sb.append("\n");
        sb.append("Use the secure link below to accept your invitation:").append("\n\n");
        sb.append("Accept Invitation").append("\n");
        sb.append(acceptUrl).append("\n\n");
        sb.append("If the button does not work, copy and paste this URL into your browser:").append("\n");
        sb.append(acceptUrl).append("\n\n");
        sb.append("If you need help, contact ").append(safeText(supportAddress)).append("\n\n");
        sb.append("If you did not expect this email, you can safely ignore it.");
        return sb.toString();
    }

    private String buildHtmlBody(
            String greetingName,
            List<String> parishNames,
            String inviterName,
            String assignedRole,
            String acceptUrl,
            String expiryText
    ) {
        String escapedGreeting = escapeHtml(buildGreeting(greetingName));
        String escapedInviterName = escapeHtml(inviterName);
        String escapedRole = escapeHtml(assignedRole);
        String escapedAcceptUrl = escapeHtml(acceptUrl);
        String escapedExpiryText = escapeHtml(expiryText);
        String escapedSupportAddress = escapeHtml(safeText(supportAddress));

        StringBuilder sb = new StringBuilder();
        sb.append("<!doctype html>");
        sb.append("<html><body style=\"font-family: Arial, sans-serif; color: #111827; line-height: 1.5;\">");
        sb.append("<p>").append(escapedGreeting).append("</p>");
        sb.append("<p>You have been invited to join <strong>Sacrament Registry</strong> for</p>");
        appendHtmlParishList(sb, parishNames);
        sb.append("<p><strong>Invited by:</strong> ").append(escapedInviterName).append("<br/>");
        if (!assignedRole.isBlank()) {
            sb.append("<strong>Assigned role:</strong> ").append(escapedRole).append("</p>");
        } else {
            sb.append("</p>");
        }
        if (!expiryText.isBlank()) {
            sb.append("<p>").append(escapedExpiryText).append("</p>");
        }
        sb.append("<p>Use the secure link below to accept your invitation:</p>");
        sb.append("<p><a href=\"")
                .append(escapedAcceptUrl)
                .append("\" style=\"display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; ")
                .append("padding: 10px 16px; border-radius: 6px;\">Accept Invitation</a></p>");
        sb.append("<p style=\"word-break: break-all;\">If the button does not work, copy and paste this URL into your browser:<br/>")
                .append(escapedAcceptUrl)
                .append("</p>");
        sb.append("<p>If you need help, contact <a href=\"mailto:")
                .append(escapedSupportAddress)
                .append("\">")
                .append(escapedSupportAddress)
                .append("</a>.</p>");
        sb.append("<p>If you did not expect this email, you can safely ignore it.</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String sanitizeHeaderValue(String value) {
        String trimmed = safeText(value);
        if (trimmed.isBlank()) {
            throw new IllegalStateException("Invitation sender address is not configured");
        }
        return trimmed.replace("\r", "").replace("\n", "");
    }

    private String buildGreeting(String firstName) {
        if (firstName == null || firstName.isBlank()) {
            return "Hello,";
        }
        return "Hello " + firstName + ",";
    }

    private List<String> resolveParishNames(AppUser invitedUser) {
        Set<String> names = new LinkedHashSet<>();
        if (invitedUser.getParishAccesses() != null) {
            invitedUser.getParishAccesses().stream()
                    .map(Parish::getParishName)
                    .map(this::safeText)
                    .filter(name -> !name.isBlank())
                    .forEach(names::add);
        }
        if (invitedUser.getParish() != null) {
            String defaultParish = safeText(invitedUser.getParish().getParishName());
            if (!defaultParish.isBlank()) {
                names.add(defaultParish);
            }
        }
        if (names.isEmpty()) {
            names.add("your parish");
        }

        List<String> sortedNames = new ArrayList<>(names);
        sortedNames.sort(Comparator.comparing(String::toLowerCase));
        return sortedNames;
    }

    private void appendPlainParishList(StringBuilder sb, List<String> parishNames) {
        for (String parishName : parishNames) {
            sb.append(" * ").append(parishName).append(".").append("\n");
        }
    }

    private void appendHtmlParishList(StringBuilder sb, List<String> parishNames) {
        sb.append("<ul>");
        for (String parishName : parishNames) {
            sb.append("<li>").append(escapeHtml(parishName)).append(".</li>");
        }
        sb.append("</ul>");
    }

    private String humanizeRole(String rawRole) {
        String normalized = safeText(rawRole);
        if (normalized.isBlank()) {
            return "";
        }
        String[] tokens = normalized.toLowerCase(Locale.ROOT).split("_+");
        StringBuilder sb = new StringBuilder();
        for (String token : tokens) {
            if (token.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(" ");
            }
            sb.append(Character.toUpperCase(token.charAt(0)));
            if (token.length() > 1) {
                sb.append(token.substring(1));
            }
        }
        return sb.toString();
    }

    private String buildExpiryText(Instant expiresAt, Instant createdAt) {
        if (expiresAt == null) {
            return "";
        }
        Instant start = createdAt != null ? createdAt : Instant.now();
        long days = Math.max(1L, (long) Math.ceil(Duration.between(start, expiresAt).toSeconds() / 86400.0d));
        if (days == 1L) {
            return "This invitation link expires in 1 day.";
        }
        return "This invitation link expires in " + days + " days.";
    }

    private String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
