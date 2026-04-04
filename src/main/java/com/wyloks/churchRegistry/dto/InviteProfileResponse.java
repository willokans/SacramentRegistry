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
public class InviteProfileResponse {
    private String title;
    private String firstName;
    private String lastName;
    private String invitedEmail;
    private Instant expiresAt;
}
