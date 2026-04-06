package com.wyloks.churchRegistry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_invitation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_invitation_app_user_id"))
    private AppUser appUser;

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    @Column(name = "invited_email", nullable = false, length = 255)
    private String invitedEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private UserInvitationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "email_delivery_status", nullable = false, length = 20)
    private UserInvitationEmailDeliveryStatus emailDeliveryStatus;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "email_sent_at")
    private Instant emailSentAt;

    @Column(name = "last_email_attempt_at")
    private Instant lastEmailAttemptAt;

    @Column(name = "last_email_error", length = 1024)
    private String lastEmailError;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_ip_address", length = 64)
    private String acceptedIpAddress;

    @Column(name = "accepted_user_agent", length = 512)
    private String acceptedUserAgent;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_invitation_created_by_user_id"))
    private AppUser createdByUser;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
