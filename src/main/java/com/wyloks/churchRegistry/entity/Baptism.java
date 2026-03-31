package com.wyloks.churchRegistry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "baptism")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Baptism {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "baptism_name", nullable = false, length = 255)
    private String baptismName;

    @Column(name = "surname", nullable = false, length = 255)
    private String surname;

    @Column(name = "gender", nullable = false, length = 10)
    private String gender;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "fathers_name", nullable = false, length = 255)
    private String fathersName;

    @Column(name = "mothers_name", nullable = false, length = 255)
    private String mothersName;

    @Column(name = "sponsor_names", nullable = false, length = 255)
    private String sponsorNames;

    @Column(name = "other_names", nullable = false, length = 255)
    private String otherNames;

    @Column(name = "officiating_priest", nullable = false, length = 255)
    private String officiatingPriest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parish_id", foreignKey = @ForeignKey(name = "fk_baptism_parish_id"))
    private Parish parish;

    @Column(name = "address", length = 500)
    private String address;

    @Column(name = "parish_address", length = 500)
    private String parishAddress;

    @Column(name = "parent_address", length = 500)
    private String parentAddress;

    @Column(name = "note")
    private String note;

    @Column(name = "external_certificate_path")
    private String externalCertificatePath;

    @Column(name = "external_certificate_issuing_parish", length = 255)
    private String externalCertificateIssuingParish;

    @Column(name = "birth_certificate_current_path")
    private String birthCertificateCurrentPath;

    @Column(name = "place_of_birth", length = 255)
    private String placeOfBirth;

    @Column(name = "place_of_baptism", length = 255)
    private String placeOfBaptism;

    @Column(name = "date_of_baptism")
    private LocalDate dateOfBaptism;

    @Column(name = "liber_no", length = 50)
    private String liberNo;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @OneToOne(mappedBy = "baptism", cascade = CascadeType.ALL, orphanRemoval = true)
    private FirstHolyCommunion firstHolyCommunion;
}
