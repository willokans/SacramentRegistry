package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DioceseWithParishesResponse {

    private Long id;
    private String dioceseName;
    private String code;
    private String description;
    private String countryCode;
    private String countryName;
    private List<ParishResponse> parishes;
}
