package com.wyloks.churchRegistry.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueUserInvitationRequest {

    @NotNull(message = "userId is required")
    @Positive(message = "userId must be a positive ID")
    private Long userId;
}
