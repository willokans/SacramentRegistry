package com.wyloks.churchRegistry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "diocese")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Diocese {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "diocese_name", nullable = false, length = 255)
    private String dioceseName;

    @Column(name = "code", length = 50)
    private String code;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "country_code", length = 2)
    private String countryCode;

    @Column(name = "country_name", length = 100)
    private String countryName;

    @Column(name = "ordinary_name", length = 255)
    private String ordinaryName;

    @Column(name = "ordinary_title", length = 100)
    private String ordinaryTitle;

    @OneToMany(mappedBy = "diocese", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Parish> parishes = new ArrayList<>();
}
