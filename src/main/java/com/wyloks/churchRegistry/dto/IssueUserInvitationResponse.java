package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueUserInvitationResponse {
    private Long invitationId;
    private Long userId;
    private String invitedEmail;
    private String token;
    private Instant expiresAt;
}
