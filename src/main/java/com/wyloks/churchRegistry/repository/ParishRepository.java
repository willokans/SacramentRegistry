package com.wyloks.churchRegistry.repository;

import com.wyloks.churchRegistry.entity.Parish;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Set;

public interface ParishRepository extends JpaRepository<Parish, Long> {

    @EntityGraph(attributePaths = {"diocese"})
    List<Parish> findByDioceseId(Long dioceseId);

    @EntityGraph(attributePaths = {"diocese"})
    List<Parish> findByDioceseIdIn(Set<Long> dioceseIds);

    @EntityGraph(attributePaths = {"diocese"})
    List<Parish> findByIdInAndDioceseId(Set<Long> parishIds, Long dioceseId);

    List<Parish> findByIdIn(Set<Long> parishIds);

    boolean existsByParishNameIgnoreCaseAndDioceseId(String parishName, Long dioceseId);
}
