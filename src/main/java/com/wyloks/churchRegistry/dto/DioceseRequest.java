package com.wyloks.churchRegistry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DioceseRequest {

    @NotBlank(message = "dioceseName is required")
    @Size(max = 255)
    private String dioceseName;

    @Size(max = 50)
    private String code;

    @Size(max = 1000)
    private String description;

    @Size(max = 2)
    private String countryCode;

    @Size(max = 100)
    private String countryName;

    @Size(max = 255)
    private String ordinaryName;

    @Size(max = 100)
    private String ordinaryTitle;

    public DioceseRequest(String dioceseName, String code, String description) {
        this.dioceseName = dioceseName;
        this.code = code;
        this.description = description;
    }
}
