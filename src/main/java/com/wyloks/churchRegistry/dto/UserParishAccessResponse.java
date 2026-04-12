package com.wyloks.churchRegistry.dto;

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
public class UserParishAccessResponse {

    private Long userId;
    private String username;
    private String displayName;
    private String role;
    private Long defaultParishId;
    private Set<Long> parishAccessIds;

    @Builder.Default
    private Set<Long> dioceseAccessIds = new HashSet<>();
}
