package com.wyloks.churchRegistry.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaptismResponse {

    private Long id;
    private String baptismName;
    private String surname;
    private String gender;
    private LocalDate dateOfBirth;
    private String fathersName;
    private String mothersName;
    private String sponsorNames;
    private String otherNames;
    private String officiatingPriest;
    private Long parishId;
    private String address;
    private String parishAddress;
    private String parentAddress;
    private String note;
    private String externalCertificatePath;
    private String externalCertificateIssuingParish;
    private String birthCertificateCurrentPath;
    private String placeOfBirth;
    private String placeOfBaptism;
    private LocalDate dateOfBaptism;
    private String liberNo;
    private OffsetDateTime createdAt;
}
