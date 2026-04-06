package com.wyloks.churchRegistry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AcceptInviteRequest {

    @NotBlank(message = "token is required")
    private String token;

    @NotBlank(message = "newPassword is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String newPassword;

    @NotBlank(message = "firstName is required")
    @Size(min = 1, max = 100)
    private String firstName;

    @NotBlank(message = "lastName is required")
    @Size(min = 1, max = 100)
    private String lastName;

    @Size(max = 20)
    private String title;
}
