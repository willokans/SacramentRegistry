package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.BaptismDocumentVersionResponse;
import com.wyloks.churchRegistry.entity.SacramentAuditLog.SacramentType;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.MarriagePartyLegacyRepository;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.BaptismService;
import com.wyloks.churchRegistry.service.BirthCertificateService;
import com.wyloks.churchRegistry.service.RemoteFileService;
import com.wyloks.churchRegistry.service.SacramentAuditService;

import com.wyloks.churchRegistry.config.TestSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CertificateController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class CertificateControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    BaptismService baptismService;

    @MockBean
    BirthCertificateService birthCertificateService;

    @MockBean
    BaptismRepository baptismRepository;

    @MockBean
    FirstHolyCommunionRepository communionRepository;

    @MockBean
    MarriagePartyLegacyRepository marriagePartyLegacyRepository;

    @MockBean
    SacramentAuthorizationService authorizationService;

    @MockBean
    RemoteFileService remoteFileService;

    @MockBean
    SacramentAuditService auditService;

    @Test
    void uploadExternalCertificate_returns200AndUpdatedBaptism() throws Exception {
        when(authorizationService.findBaptismParishId(1L)).thenReturn(Optional.of(10L));
        doNothing().when(authorizationService).requireWriteAccessForParish(10L);
        when(remoteFileService.upload(eq("baptism-certificates"), anyString(), any(), anyString()))
                .thenReturn("1730000000-cert.pdf");

        String storedPath = "baptism-certificates/1730000000-cert.pdf";
        BaptismResponse updated = BaptismResponse.builder()
                .id(1L)
                .baptismName("John")
                .surname("Doe")
                .externalCertificatePath(storedPath)
                .build();
        when(baptismService.attachExternalCertificate(eq(1L), eq(storedPath))).thenReturn(updated);

        MockMultipartFile file = new MockMultipartFile(
                "file", "cert.pdf", "application/pdf", "hello".getBytes());

        mvc.perform(multipart("/api/baptisms/1/external-certificate").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.externalCertificatePath").value(storedPath));

        verify(auditService).logUpdate(SacramentType.BAPTISM, 1L, 10L, "external_certificate_upload");
    }

    @Test
    void uploadExternalCertificate_returns404_whenBaptismHasNoParish() throws Exception {
        when(authorizationService.findBaptismParishId(1L)).thenReturn(Optional.empty());

        MockMultipartFile file = new MockMultipartFile(
                "file", "cert.pdf", "application/pdf", "x".getBytes());

        mvc.perform(multipart("/api/baptisms/1/external-certificate").file(file))
                .andExpect(status().isNotFound());

        verify(remoteFileService, never()).upload(anyString(), anyString(), any(), anyString());
        verify(baptismService, never()).attachExternalCertificate(any(), anyString());
    }

    @Test
    void uploadExternalCertificate_returns409_whenCertificateAlreadyStored() throws Exception {
        when(authorizationService.findBaptismParishId(1L)).thenReturn(Optional.of(10L));
        doNothing().when(authorizationService).requireWriteAccessForParish(10L);
        when(remoteFileService.upload(eq("baptism-certificates"), anyString(), any(), anyString()))
                .thenReturn("1730000000-cert.pdf");
        when(baptismService.attachExternalCertificate(eq(1L), eq("baptism-certificates/1730000000-cert.pdf")))
                .thenThrow(new IllegalStateException("External baptism certificate is already stored for this record"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "cert.pdf", "application/pdf", "hello".getBytes());

        mvc.perform(multipart("/api/baptisms/1/external-certificate").file(file))
                .andExpect(status().isConflict());
    }

    @Test
    void uploadExternalCertificate_returns400_whenFileEmpty() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "cert.pdf", "application/pdf", new byte[0]);

        mvc.perform(multipart("/api/baptisms/1/external-certificate").file(file))
                .andExpect(status().isBadRequest());

        verify(remoteFileService, never()).upload(anyString(), anyString(), any(), anyString());
        verify(baptismService, never()).attachExternalCertificate(any(), anyString());
    }

    @Test
    void uploadBirthCertificate_returns200AndCreatedVersion() throws Exception {
        when(authorizationService.findBaptismParishId(1L)).thenReturn(Optional.of(10L));
        doNothing().when(authorizationService).requireWriteAccessForParish(10L);
        when(birthCertificateService.upload(eq(1L), any())).thenReturn(BaptismDocumentVersionResponse.builder()
                .id(101L)
                .baptismId(1L)
                .documentType("BIRTH_CERTIFICATE")
                .originalFilename("birth.pdf")
                .current(true)
                .build());

        MockMultipartFile file = new MockMultipartFile(
                "file", "birth.pdf", "application/pdf", "hello".getBytes());

        mvc.perform(multipart("/api/baptisms/1/birth-certificate").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.documentType").value("BIRTH_CERTIFICATE"))
                .andExpect(jsonPath("$.current").value(true));

        verify(auditService).logUpdate(SacramentType.BAPTISM, 1L, 10L, "birth_certificate_upload");
    }

    @Test
    void listBirthCertificateVersions_returns200() throws Exception {
        when(authorizationService.findBaptismParishId(1L)).thenReturn(Optional.of(10L));
        doNothing().when(authorizationService).requireParishAccess(10L);
        when(birthCertificateService.listVersions(1L)).thenReturn(List.of(
                BaptismDocumentVersionResponse.builder().id(2L).current(true).build(),
                BaptismDocumentVersionResponse.builder().id(1L).current(false).build()
        ));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/baptisms/1/birth-certificate/versions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2))
                .andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[1].id").value(1))
                .andExpect(jsonPath("$[1].current").value(false));
    }
}
