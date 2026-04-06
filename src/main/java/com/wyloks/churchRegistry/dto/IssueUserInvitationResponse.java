package com.wyloks.churchRegistry.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wyloks.churchRegistry.entity.UserInvitationEmailDeliveryStatus;
import com.wyloks.churchRegistry.entity.UserInvitationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class IssueUserInvitationResponse {
    private Long invitationId;
    private Long userId;
    private String invitedEmail;
    private String token;
    private Instant expiresAt;
    private UserInvitationStatus invitationStatus;
    private UserInvitationEmailDeliveryStatus emailDeliveryStatus;
    private Instant lastEmailAttemptAt;
    private String lastEmailError;
    private Instant emailSentAt;
    private String deliveryMessage;
}
