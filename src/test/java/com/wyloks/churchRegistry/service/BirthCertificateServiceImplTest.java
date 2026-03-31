package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.BaptismDocumentVersionResponse;
import com.wyloks.churchRegistry.entity.Baptism;
import com.wyloks.churchRegistry.entity.BaptismDocumentVersion;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.BaptismDocumentVersionRepository;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.service.impl.BirthCertificateServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BirthCertificateServiceImplTest {

    @Mock
    BaptismRepository baptismRepository;

    @Mock
    BaptismDocumentVersionRepository documentVersionRepository;

    @Mock
    AppUserRepository appUserRepository;

    @Mock
    RemoteFileService remoteFileService;

    @InjectMocks
    BirthCertificateServiceImpl service;

    @Test
    void upload_throwsWhenBaptismNotFound() {
        when(baptismRepository.findById(1L)).thenReturn(Optional.empty());
        MockMultipartFile file = new MockMultipartFile("file", "birth.pdf", "application/pdf", "abc".getBytes());

        assertThatThrownBy(() -> service.upload(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Baptism not found");
    }

    @Test
    void upload_createsNewCurrentVersionAndUpdatesBaptismPointer() {
        Baptism baptism = Baptism.builder().id(1L).build();
        when(baptismRepository.findById(1L)).thenReturn(Optional.of(baptism));
        when(remoteFileService.upload(eq("birth-certificates"), any(), any(), eq("application/pdf")))
                .thenReturn("birth_cert_1_random_birth.pdf");
        when(documentVersionRepository.save(any(BaptismDocumentVersion.class))).thenAnswer(inv -> {
            BaptismDocumentVersion entity = inv.getArgument(0);
            entity.setId(99L);
            if (entity.getUploadedAt() == null) {
                entity.setUploadedAt(OffsetDateTime.now());
            }
            return entity;
        });
        when(baptismRepository.save(any(Baptism.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile("file", "birth.pdf", "application/pdf", "abc".getBytes());
        BaptismDocumentVersionResponse response = service.upload(1L, file);

        assertThat(response.getId()).isEqualTo(99L);
        assertThat(response.getBaptismId()).isEqualTo(1L);
        assertThat(response.isCurrent()).isTrue();
        assertThat(baptism.getBirthCertificateCurrentPath())
                .isEqualTo("birth-certificates/birth_cert_1_random_birth.pdf");
        verify(documentVersionRepository).clearCurrentByBaptismIdAndDocumentType(1L, "BIRTH_CERTIFICATE");
    }

    @Test
    void listVersions_throwsWhenBaptismDoesNotExist() {
        when(baptismRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> service.listVersions(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Baptism not found");
        verify(documentVersionRepository, never()).findByBaptismIdAndDocumentTypeOrderByUploadedAtDescIdDesc(any(), any());
    }

    @Test
    void listVersions_returnsOrderedResponses() {
        when(baptismRepository.existsById(1L)).thenReturn(true);
        Baptism baptism = Baptism.builder().id(1L).build();
        BaptismDocumentVersion latest = BaptismDocumentVersion.builder()
                .id(2L)
                .baptism(baptism)
                .documentType("BIRTH_CERTIFICATE")
                .originalFilename("latest.pdf")
                .contentType("application/pdf")
                .sizeBytes(22L)
                .uploadedAt(OffsetDateTime.now())
                .current(true)
                .build();
        BaptismDocumentVersion older = BaptismDocumentVersion.builder()
                .id(1L)
                .baptism(baptism)
                .documentType("BIRTH_CERTIFICATE")
                .originalFilename("older.pdf")
                .contentType("application/pdf")
                .sizeBytes(11L)
                .uploadedAt(OffsetDateTime.now().minusDays(1))
                .current(false)
                .build();
        when(documentVersionRepository.findByBaptismIdAndDocumentTypeOrderByUploadedAtDescIdDesc(1L, "BIRTH_CERTIFICATE"))
                .thenReturn(List.of(latest, older));

        List<BaptismDocumentVersionResponse> responses = service.listVersions(1L);
        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getId()).isEqualTo(2L);
        assertThat(responses.get(1).getId()).isEqualTo(1L);
    }
}
