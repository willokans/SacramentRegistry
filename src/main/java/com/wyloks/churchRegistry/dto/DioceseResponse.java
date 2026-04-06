package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DioceseResponse {

    private Long id;
    private String dioceseName;
    private String code;
    private String description;
    private String countryCode;
    private String countryName;
    private String ordinaryName;
    private String ordinaryTitle;

    public DioceseResponse(Long id, String dioceseName, String code, String description) {
        this.id = id;
        this.dioceseName = dioceseName;
        this.code = code;
        this.description = description;
    }
}
