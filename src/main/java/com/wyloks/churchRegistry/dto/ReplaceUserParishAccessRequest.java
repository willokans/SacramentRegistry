package com.wyloks.churchRegistry.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
public class ReplaceUserParishAccessRequest {

    @NotNull(message = "parishIds is required")
    @Builder.Default
    private Set<@NotNull(message = "parishIds must not contain null values")
            @Positive(message = "parishIds must contain only positive IDs") Long> parishIds = new HashSet<>();

    /**
     * For {@code DIOCESE_ADMIN} users, super-admins must send non-empty diocese ids; parish access is re-derived.
     * {@link #parishIds} is ignored for that role.
     */
    @Builder.Default
    private Set<@NotNull(message = "dioceseIds must not contain null values")
            @Positive(message = "dioceseIds must contain only positive IDs") Long> dioceseIds = new HashSet<>();

    @Positive(message = "defaultParishId must be a positive ID")
    private Long defaultParishId;
}
