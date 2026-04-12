package com.wyloks.churchRegistry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, unique = true, length = 100)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parish_id", foreignKey = @ForeignKey(name = "fk_app_user_parish_id"))
    private Parish parish;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "app_user_parish_access",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "parish_id")
    )
    @Builder.Default
    private Set<Parish> parishAccesses = new HashSet<>();

    /**
     * Diocese-level scope for {@code DIOCESE_ADMIN}; parish rows in {@link #parishAccesses} are kept in sync
     * (all parishes in these dioceses) for RLS and existing parish-scoped checks.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "app_user_diocese_access",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "diocese_id")
    )
    @Builder.Default
    private Set<Diocese> dioceseAccesses = new HashSet<>();

    @Column(name = "role", length = 50)
    private String role;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "title", length = 20)
    private String title;

    @Column(name = "email", length = 255, unique = true)
    private String email;

    @Column(name = "must_reset_password", nullable = false)
    @Builder.Default
    private boolean mustResetPassword = false;
}
