package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaptismDocumentVersionResponse {

    private Long id;
    private Long baptismId;
    private String documentType;
    private String originalFilename;
    private String contentType;
    private Long sizeBytes;
    private OffsetDateTime uploadedAt;
    private Long uploadedById;
    private String uploadedByName;
    private boolean current;
}
