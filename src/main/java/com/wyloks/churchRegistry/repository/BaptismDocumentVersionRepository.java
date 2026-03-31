package com.wyloks.churchRegistry.repository;

import com.wyloks.churchRegistry.entity.BaptismDocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BaptismDocumentVersionRepository extends JpaRepository<BaptismDocumentVersion, Long> {

    List<BaptismDocumentVersion> findByBaptismIdAndDocumentTypeOrderByUploadedAtDescIdDesc(Long baptismId, String documentType);

    Optional<BaptismDocumentVersion> findFirstByBaptismIdAndDocumentTypeAndCurrentTrue(Long baptismId, String documentType);

    Optional<BaptismDocumentVersion> findByIdAndBaptismIdAndDocumentType(Long id, Long baptismId, String documentType);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE BaptismDocumentVersion v SET v.current = false " +
            "WHERE v.baptism.id = :baptismId AND v.documentType = :documentType AND v.current = true")
    int clearCurrentByBaptismIdAndDocumentType(
            @Param("baptismId") Long baptismId,
            @Param("documentType") String documentType
    );
}
