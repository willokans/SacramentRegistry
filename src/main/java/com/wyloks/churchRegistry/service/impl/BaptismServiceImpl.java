package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.BaptismRequest;
import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.SacramentNoteResponse;
import com.wyloks.churchRegistry.entity.Baptism;
import com.wyloks.churchRegistry.entity.FirstHolyCommunion;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.SacramentNoteHistory;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import com.wyloks.churchRegistry.repository.SacramentNoteHistoryRepository;
import com.wyloks.churchRegistry.security.AppUserDetails;
import com.wyloks.churchRegistry.service.BaptismService;
import com.wyloks.churchRegistry.util.NameUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BaptismServiceImpl implements BaptismService {

    private final BaptismRepository baptismRepository;
    private final FirstHolyCommunionRepository firstHolyCommunionRepository;
    private final ParishRepository parishRepository;
    private final SacramentNoteHistoryRepository noteHistoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<BaptismResponse> findByParishId(Long parishId) {
        return baptismRepository.findByParishId(parishId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BaptismResponse> findByParishId(Long parishId, Pageable pageable) {
        return baptismRepository.findByParishId(parishId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BaptismResponse> findByParishIdIn(Set<Long> parishIds, Pageable pageable) {
        if (parishIds == null || parishIds.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        return baptismRepository.findByParishIdIn(parishIds, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BaptismResponse> searchByNameOrAddress(Long parishId, String query, Pageable pageable) {
        return baptismRepository.searchByNameOrAddress(parishId, query, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BaptismResponse> findById(Long id) {
        return baptismRepository.findById(id).map(this::toResponse);
    }

    @Override
    @Transactional
    public BaptismResponse create(Long parishId, BaptismRequest request) {
        Parish parish = parishId != null
                ? parishRepository.findById(parishId).orElseThrow(() -> new IllegalArgumentException("Parish not found: " + parishId))
                : null;
        Baptism entity = Baptism.builder()
                .baptismName(NameUtils.capitalizeNameOrEmpty(request.getBaptismName()))
                .surname(NameUtils.capitalizeNameOrEmpty(request.getSurname()))
                .gender(request.getGender())
                .dateOfBirth(request.getDateOfBirth())
                .fathersName(NameUtils.capitalizeNameOrEmpty(request.getFathersName()))
                .mothersName(NameUtils.capitalizeNameOrEmpty(request.getMothersName()))
                .sponsorNames(NameUtils.capitalizeNameOrEmpty(request.getSponsorNames()))
                .otherNames(NameUtils.capitalizeNameOrEmpty(request.getOtherNames()))
                .officiatingPriest(NameUtils.capitalizeNameOrEmpty(request.getOfficiatingPriest()))
                .parish(parish)
                .address(request.getAddress())
                .parishAddress(request.getParishAddress())
                .parentAddress(request.getParentAddress())
                .note(request.getNote())
                .externalCertificatePath(request.getExternalCertificatePath())
                .externalCertificateIssuingParish(NameUtils.capitalizeNameOrEmpty(request.getExternalCertificateIssuingParish()))
                .placeOfBirth(request.getPlaceOfBirth() != null ? request.getPlaceOfBirth().trim() : null)
                .placeOfBaptism(request.getPlaceOfBaptism() != null ? request.getPlaceOfBaptism().trim() : null)
                .dateOfBaptism(request.getDateOfBaptism())
                .liberNo(request.getLiberNo() != null ? request.getLiberNo().trim() : null)
                .build();
        entity = baptismRepository.save(entity);
        return toResponse(entity);
    }

    @Override
    @Transactional
    public BaptismResponse attachExternalCertificate(Long baptismId, String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            throw new IllegalArgumentException("Stored certificate path is required");
        }
        Baptism baptism = baptismRepository.findById(baptismId)
                .orElseThrow(() -> new IllegalArgumentException("Baptism not found: " + baptismId));
        String issuing = baptism.getExternalCertificateIssuingParish();
        if (issuing == null || issuing.isBlank()) {
            throw new IllegalArgumentException("External baptism certificate upload applies only to external baptisms");
        }
        if (baptism.getExternalCertificatePath() != null && !baptism.getExternalCertificatePath().isBlank()) {
            throw new IllegalStateException("External baptism certificate is already stored for this record");
        }
        Optional<FirstHolyCommunion> communionOpt = firstHolyCommunionRepository.findByBaptismId(baptismId);
        if (communionOpt.isPresent()) {
            FirstHolyCommunion communion = communionOpt.get();
            String communionPath = communion.getBaptismCertificatePath();
            if (communionPath != null && !communionPath.isBlank()) {
                throw new IllegalStateException("Baptism certificate path is already set on the linked communion");
            }
        }
        baptism.setExternalCertificatePath(storedPath.trim());
        baptism = baptismRepository.save(baptism);
        communionOpt.ifPresent(communion -> {
            communion.setBaptismCertificatePath(storedPath.trim());
            firstHolyCommunionRepository.save(communion);
        });
        return toResponse(baptism);
    }

    @Override
    @Transactional
    public BaptismResponse updateNote(Long id, String note) {
        Baptism baptism = baptismRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Baptism not found: " + id));
        String safeNote = note == null ? "" : note;
        baptism.setNote(safeNote);
        baptism = baptismRepository.save(baptism);
        noteHistoryRepository.save(SacramentNoteHistory.builder()
                .sacramentType("BAPTISM")
                .recordId(id)
                .content(safeNote)
                .createdBy(resolveActorName())
                .build());
        return toResponse(baptism);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SacramentNoteResponse> getNoteHistory(Long id) {
        return noteHistoryRepository
                .findBySacramentTypeAndRecordIdOrderByCreatedAtDesc("BAPTISM", id)
                .stream()
                .map(this::toNoteResponse)
                .collect(Collectors.toList());
    }

    private BaptismResponse toResponse(Baptism e) {
        return BaptismResponse.builder()
                .id(e.getId())
                .baptismName(e.getBaptismName())
                .surname(e.getSurname())
                .gender(e.getGender())
                .dateOfBirth(e.getDateOfBirth())
                .fathersName(e.getFathersName())
                .mothersName(e.getMothersName())
                .sponsorNames(e.getSponsorNames())
                .otherNames(e.getOtherNames())
                .officiatingPriest(e.getOfficiatingPriest())
                .parishId(e.getParish() != null ? e.getParish().getId() : null)
                .address(e.getAddress())
                .parishAddress(e.getParishAddress())
                .parentAddress(e.getParentAddress())
                .note(e.getNote())
                .externalCertificatePath(e.getExternalCertificatePath())
                .externalCertificateIssuingParish(e.getExternalCertificateIssuingParish())
                .birthCertificateCurrentPath(e.getBirthCertificateCurrentPath())
                .placeOfBirth(e.getPlaceOfBirth())
                .placeOfBaptism(e.getPlaceOfBaptism())
                .dateOfBaptism(e.getDateOfBaptism())
                .liberNo(e.getLiberNo())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private SacramentNoteResponse toNoteResponse(SacramentNoteHistory n) {
        return SacramentNoteResponse.builder()
                .id(n.getId())
                .content(n.getContent())
                .createdAt(n.getCreatedAt())
                .createdBy(n.getCreatedBy())
                .build();
    }

    private String resolveActorName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AppUserDetails userDetails) {
            if (userDetails.getAppUser() != null && userDetails.getAppUser().getDisplayName() != null
                    && !userDetails.getAppUser().getDisplayName().isBlank()) {
                return userDetails.getAppUser().getDisplayName().trim();
            }
            if (userDetails.getRole() != null && !userDetails.getRole().isBlank()) {
                String[] parts = userDetails.getRole().trim().toLowerCase(Locale.ROOT).split("_");
                return java.util.Arrays.stream(parts)
                        .filter(p -> !p.isBlank())
                        .map(p -> Character.toUpperCase(p.charAt(0)) + p.substring(1))
                        .collect(Collectors.joining(" "));
            }
            return userDetails.getUsername();
        }
        return "System";
    }
}
