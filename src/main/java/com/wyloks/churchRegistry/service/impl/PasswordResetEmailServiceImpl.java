package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.service.PasswordResetEmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class PasswordResetEmailServiceImpl implements PasswordResetEmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public PasswordResetEmailServiceImpl() {
        // Spring default constructor
    }

    public PasswordResetEmailServiceImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Value("${app.password-reset.public-base-url:http://localhost:3000}")
    private String publicBaseUrl;

    @Value("${app.password-reset.email.from:${app.invitation.email.from:onboarding@sacramentregistry.com}}")
    private String fromAddress;

    @Value("${app.password-reset.email.support:${app.invitation.email.support:support@sacramentregistry.com}}")
    private String supportAddress;

    private static final String SUBJECT = "Reset your Sacrament Registry password";
    private static final String CTA_LABEL = "Reset your password";
    private static final String SIGN_OFF_BRAND = "Sacrament Registry";
    private static final String SIGN_OFF_TAGLINE = "Secure sacramental record management for Catholic parishes";

    @Override
    public void sendPasswordResetEmail(String recipientEmail, String rawToken, String parishName) {
        String recipient = normalizeRecipient(recipientEmail);
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password reset token is required");
        }

        String resetUrl = buildResetUrl(rawToken);
        String parishLine = normalizeParishContext(parishName);
        String plainTextBody = buildPlainTextBody(resetUrl, parishLine);
        String htmlBody = buildHtmlBody(resetUrl, parishLine);

        try {
            JavaMailSender resolvedMailSender = resolveMailSender();
            MimeMessage message = resolvedMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(sanitizeHeaderValue(fromAddress));
            helper.setTo(recipient);
            helper.setSubject(SUBJECT);
            helper.setText(plainTextBody, htmlBody);
            resolvedMailSender.send(message);
        } catch (MessagingException ex) {
            throw new IllegalStateException("Failed to construct password reset email message", ex);
        }
    }

    private JavaMailSender resolveMailSender() {
        if (mailSender == null) {
            throw new IllegalStateException("Password reset email delivery is not configured");
        }
        return mailSender;
    }

    private String buildResetUrl(String rawToken) {
        String base = safeText(publicBaseUrl);
        if (base.isBlank()) {
            throw new IllegalStateException("app.password-reset.public-base-url is not configured");
        }
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return UriComponentsBuilder.fromHttpUrl(base + "/reset-password")
                .queryParam("token", rawToken.trim())
                .build()
                .toUriString();
    }

    private String normalizeRecipient(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient email is required");
        }
        return email.trim();
    }

    private String normalizeParishContext(String parishName) {
        String p = safeText(parishName);
        return p.isBlank() ? null : p;
    }

    private String buildPlainTextBody(String resetUrl, String parishLine) {
        String support = safeText(supportAddress);
        StringBuilder sb = new StringBuilder();
        sb.append("Hello,\n\n");
        sb.append("We received a request to reset the password for your Sacrament Registry account.\n\n");
        if (parishLine != null) {
            sb.append("If it helps you know this message is really for you: your account is associated with ")
                    .append(parishLine)
                    .append(".\n\n");
        }
        sb.append("To choose a new password, please use the secure link below:\n\n");
        sb.append(CTA_LABEL).append("\n").append(resetUrl).append("\n\n");
        sb.append("If the link above does not open, copy and paste this address into your browser:\n");
        sb.append(resetUrl).append("\n\n");
        sb.append("This link will expire shortly for your security.\n\n");
        sb.append("If you did not request a password reset, you can safely ignore this email — your account will remain unchanged.\n\n");
        if (!support.isBlank()) {
            sb.append("If you need help, please contact us at ").append(support).append("\n\n");
        }
        sb.append("— ").append(SIGN_OFF_BRAND).append("\n");
        sb.append(SIGN_OFF_TAGLINE).append("\n");
        return sb.toString();
    }

    private String buildHtmlBody(String resetUrl, String parishLine) {
        String escapedUrl = escapeHtml(resetUrl);
        String escapedSupport = escapeHtml(safeText(supportAddress));
        String escapedParish = parishLine != null ? escapeHtml(parishLine) : null;
        StringBuilder sb = new StringBuilder();
        sb.append("<!doctype html>");
        sb.append("<html><body style=\"font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.55; font-size: 15px;\">");
        sb.append("<p>Hello,</p>");
        sb.append("<p>We received a request to reset the password for your <strong>Sacrament Registry</strong> account.</p>");
        if (escapedParish != null) {
            sb.append("<p>If it helps you know this message is really for you: your account is associated with <strong>")
                    .append(escapedParish)
                    .append("</strong>.</p>");
        }
        sb.append("<p>To choose a new password, please use the secure link below:</p>");
        sb.append("<p><a href=\"")
                .append(escapedUrl)
                .append("\" style=\"display: inline-block; background: #6b2d3c; color: #ffffff; text-decoration: none; ")
                .append("padding: 12px 20px; border-radius: 8px; font-weight: 600;\">")
                .append(escapeHtml(CTA_LABEL))
                .append("</a></p>");
        sb.append("<p style=\"word-break: break-all; font-size: 14px; color: #374151;\">If the button above does not work, copy and paste this link into your browser:<br/>")
                .append(escapedUrl)
                .append("</p>");
        sb.append("<p>This link will expire shortly for your security.</p>");
        sb.append("<p>If you did not request a password reset, you can safely ignore this email — your account will remain unchanged.</p>");
        if (!escapedSupport.isEmpty()) {
            sb.append("<p>If you need help, please contact us at <a href=\"mailto:")
                    .append(escapedSupport)
                    .append("\" style=\"color: #6b2d3c;\">")
                    .append(escapedSupport)
                    .append("</a>.</p>");
        }
        sb.append("<p style=\"margin-top: 1.75em; color: #374151; font-size: 14px;\">— ")
                .append(escapeHtml(SIGN_OFF_BRAND))
                .append("<br/>")
                .append(escapeHtml(SIGN_OFF_TAGLINE))
                .append("</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String sanitizeHeaderValue(String value) {
        String trimmed = safeText(value);
        if (trimmed.isBlank()) {
            throw new IllegalStateException("Password reset sender address is not configured");
        }
        return trimmed.replace("\r", "").replace("\n", "");
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
