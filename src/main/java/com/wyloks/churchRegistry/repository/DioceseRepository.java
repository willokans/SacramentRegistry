package com.wyloks.churchRegistry.repository;

import com.wyloks.churchRegistry.entity.Diocese;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Set;

public interface DioceseRepository extends JpaRepository<Diocese, Long> {

    @EntityGraph(attributePaths = {"parishes"})
    @Query("SELECT d FROM Diocese d")
    List<Diocese> findAllWithParishes();

    @EntityGraph(attributePaths = {"parishes"})
    List<Diocese> findDistinctByParishesIdIn(Set<Long> parishIds);

    List<Diocese> findByCountryCodeIgnoreCaseOrderByDioceseNameAsc(String countryCode);

    List<Diocese> findByCountryCodeIgnoreCaseAndDioceseNameContainingIgnoreCaseOrderByDioceseNameAsc(
            String countryCode,
            String query
    );

    boolean existsByDioceseNameIgnoreCase(String dioceseName);
}
