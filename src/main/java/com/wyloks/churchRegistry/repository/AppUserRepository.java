package com.wyloks.churchRegistry.repository;

import com.wyloks.churchRegistry.entity.AppUser;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    Optional<AppUser> findByUsername(String username);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    @Query("SELECT u FROM AppUser u WHERE u.username = :identifier OR u.email = :identifier")
    Optional<AppUser> findByUsernameOrEmail(@Param("identifier") String identifier);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    Optional<AppUser> findByEmail(String email);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    Optional<AppUser> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    Optional<AppUser> findWithParishAccessesById(Long id);

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    List<AppUser> findAllByOrderByUsernameAsc();

    @EntityGraph(attributePaths = {"parish", "parishAccesses"})
    @Query("""
            SELECT u FROM AppUser u
            WHERE (:q IS NULL OR TRIM(:q) = '' OR
                LOWER(COALESCE(u.username, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                LOWER(COALESCE(u.displayName, '')) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<AppUser> searchByUserMetadata(@Param("q") String query, Pageable pageable);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /** Case-insensitive check for first name + last name combination. */
    boolean existsByFirstNameIgnoreCaseAndLastNameIgnoreCase(String firstName, String lastName);
}
