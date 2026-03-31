package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.BaptismDocumentVersionResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Baptism;
import com.wyloks.churchRegistry.entity.BaptismDocumentVersion;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.BaptismDocumentVersionRepository;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.security.AppUserDetails;
import com.wyloks.churchRegistry.service.BirthCertificateService;
import com.wyloks.churchRegistry.service.RemoteFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BirthCertificateServiceImpl implements BirthCertificateService {

    private static final String BIRTH_CERTIFICATES_BUCKET = "birth-certificates";
    private static final String BIRTH_CERTIFICATES_PREFIX = "birth";
    private static final String DOCUMENT_TYPE = "BIRTH_CERTIFICATE";
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png"
    );

    private final BaptismRepository baptismRepository;
    private final BaptismDocumentVersionRepository documentVersionRepository;
    private final AppUserRepository appUserRepository;
    private final RemoteFileService remoteFileService;

    @Override
    @Transactional
    public BaptismDocumentVersionResponse upload(Long baptismId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Birth certificate file is required");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("Birth certificate file is too large. Maximum size is 5 MB.");
        }
        validateFileType(file);

        Baptism baptism = baptismRepository.findById(baptismId)
                .orElseThrow(() -> new IllegalArgumentException("Baptism not found: " + baptismId));

        String originalName = sanitizeOriginalFilename(file.getOriginalFilename());
        String contentType = normalizeContentType(file.getContentType(), originalName);
        String objectName = BIRTH_CERTIFICATES_PREFIX + "_cert_" + baptismId + "_" + UUID.randomUUID() + "_" + originalName;
        String storedPath = uploadFile(objectName, file, contentType);

        documentVersionRepository.clearCurrentByBaptismIdAndDocumentType(baptismId, DOCUMENT_TYPE);

        BaptismDocumentVersion version = BaptismDocumentVersion.builder()
                .baptism(baptism)
                .documentType(DOCUMENT_TYPE)
                .storagePath(storedPath)
                .originalFilename(originalName)
                .contentType(contentType)
                .sizeBytes(file.getSize())
                .uploadedBy(resolveActorUser())
                .uploadedAt(OffsetDateTime.now())
                .current(true)
                .build();
        version = documentVersionRepository.save(version);

        baptism.setBirthCertificateCurrentPath(storedPath);
        baptismRepository.save(baptism);

        return toResponse(version);
    }

    @Override
    @Transactional(readOnly = true)
    public RemoteFileService.RemoteFile downloadCurrent(Long baptismId) {
        BaptismDocumentVersion current = documentVersionRepository
                .findFirstByBaptismIdAndDocumentTypeAndCurrentTrue(baptismId, DOCUMENT_TYPE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Birth certificate not found"));
        return remoteFileService.download(current.getStoragePath());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BaptismDocumentVersionResponse> listVersions(Long baptismId) {
        if (!baptismRepository.existsById(baptismId)) {
            throw new IllegalArgumentException("Baptism not found: " + baptismId);
        }
        return documentVersionRepository
                .findByBaptismIdAndDocumentTypeOrderByUploadedAtDescIdDesc(baptismId, DOCUMENT_TYPE)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RemoteFileService.RemoteFile downloadVersion(Long baptismId, Long versionId) {
        BaptismDocumentVersion version = documentVersionRepository
                .findByIdAndBaptismIdAndDocumentType(versionId, baptismId, DOCUMENT_TYPE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Birth certificate version not found"));
        return remoteFileService.download(version.getStoragePath());
    }

    private String uploadFile(String objectName, MultipartFile file, String contentType) {
        try {
            String objectPath = remoteFileService.upload(BIRTH_CERTIFICATES_BUCKET, objectName, file.getBytes(), contentType);
            return BIRTH_CERTIFICATES_BUCKET + "/" + objectPath;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to read birth certificate upload", ex);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to upload birth certificate", ex);
        }
    }

    private void validateFileType(MultipartFile file) {
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        boolean extensionAllowed = originalName.endsWith(".pdf")
                || originalName.endsWith(".jpg")
                || originalName.endsWith(".jpeg")
                || originalName.endsWith(".png");

        String contentType = file.getContentType();
        boolean contentTypeAllowed = contentType != null && ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT));
        if (!extensionAllowed && !contentTypeAllowed) {
            throw new IllegalArgumentException("Birth certificate must be a PDF, JPG, or PNG file");
        }
    }

    private String sanitizeOriginalFilename(String originalFilename) {
        String fallback = "birth_certificate";
        if (originalFilename == null || originalFilename.isBlank()) {
            return fallback;
        }
        String sanitized = originalFilename.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
        return sanitized.isBlank() ? fallback : sanitized;
    }

    private String normalizeContentType(String rawContentType, String fileName) {
        if (rawContentType != null && !rawContentType.isBlank()) {
            return rawContentType.trim();
        }
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        return "image/jpeg";
    }

    private AppUser resolveActorUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails userDetails)) {
            return null;
        }
        AppUser principalUser = userDetails.getAppUser();
        if (principalUser == null || principalUser.getId() == null) {
            return null;
        }
        return appUserRepository.findById(principalUser.getId()).orElse(null);
    }

    private BaptismDocumentVersionResponse toResponse(BaptismDocumentVersion entity) {
        AppUser uploader = entity.getUploadedBy();
        return BaptismDocumentVersionResponse.builder()
                .id(entity.getId())
                .baptismId(entity.getBaptism() != null ? entity.getBaptism().getId() : null)
                .documentType(entity.getDocumentType())
                .originalFilename(entity.getOriginalFilename())
                .contentType(entity.getContentType())
                .sizeBytes(entity.getSizeBytes())
                .uploadedAt(entity.getUploadedAt())
                .uploadedById(uploader != null ? uploader.getId() : null)
                .uploadedByName(resolveUploaderDisplayName(uploader))
                .current(entity.isCurrent())
                .build();
    }

    private String resolveUploaderDisplayName(AppUser uploader) {
        if (uploader == null) {
            return null;
        }
        if (uploader.getDisplayName() != null && !uploader.getDisplayName().isBlank()) {
            return uploader.getDisplayName().trim();
        }
        return uploader.getUsername();
    }
}
