package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForgotPasswordResponse {

    /**
     * Same user-facing text for every non-empty identifier; does not reveal whether an account exists.
     */
    public static final String MESSAGE =
            "If an account exists for this username, we've sent password reset instructions to the email on file.";

    @Builder.Default
    private String message = MESSAGE;
}
