package com.wyloks.churchRegistry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashSet;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateUserRequest {

    @NotBlank(message = "username is required")
    @Size(min = 1, max = 100)
    private String username;

    @Size(max = 255)
    private String email;

    @NotBlank(message = "firstName is required")
    @Size(min = 1, max = 100)
    private String firstName;

    @NotBlank(message = "lastName is required")
    @Size(min = 1, max = 100)
    private String lastName;

    @Size(max = 20)
    private String title;

    @NotBlank(message = "role is required")
    private String role;

    @Positive(message = "defaultParishId must be a positive ID")
    private Long defaultParishId;

    @Builder.Default
    private Set<@NotNull(message = "parishIds must not contain null values")
            @Positive(message = "parishIds must contain only positive IDs") Long> parishIds = new HashSet<>();

    /** Required when {@code role} is {@code DIOCESE_ADMIN}; parish access is derived from these dioceses. */
    @Builder.Default
    private Set<@NotNull(message = "dioceseIds must not contain null values")
            @Positive(message = "dioceseIds must contain only positive IDs") Long> dioceseIds = new HashSet<>();

    @NotBlank(message = "defaultPassword is required")
    @Size(min = 8, message = "defaultPassword must be at least 8 characters")
    private String defaultPassword;
}
