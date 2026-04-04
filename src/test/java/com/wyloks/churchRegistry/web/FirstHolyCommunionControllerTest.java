package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.wyloks.churchRegistry.dto.BaptismRequest;
import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionRequest;
import com.wyloks.churchRegistry.dto.FirstHolyCommunionResponse;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.BaptismService;
import com.wyloks.churchRegistry.service.FirstHolyCommunionService;
import com.wyloks.churchRegistry.service.RemoteFileService;
import com.wyloks.churchRegistry.service.SacramentAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.wyloks.churchRegistry.config.TestSecurityConfig;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = FirstHolyCommunionController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class FirstHolyCommunionControllerTest {

    @Autowired
    MockMvc mvc;

    ObjectMapper objectMapper;

    @MockBean
    FirstHolyCommunionService communionService;

    @MockBean
    BaptismService baptismService;

    @MockBean
    RemoteFileService remoteFileService;

    @MockBean
    SacramentAuthorizationService sacramentAuthorizationService;

    @MockBean
    SacramentAuditService sacramentAuditService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    void create_returns201_whenValid() throws Exception {
        FirstHolyCommunionRequest request = FirstHolyCommunionRequest.builder()
                .baptismId(1L)
                .communionDate(LocalDate.of(2022, 6, 1))
                .officiatingPriest("Fr. Smith")
                .parish("St Mary")
                .build();
        FirstHolyCommunionResponse response = FirstHolyCommunionResponse.builder()
                .id(1L)
                .baptismId(1L)
                .communionDate(LocalDate.of(2022, 6, 1))
                .officiatingPriest("Fr. Smith")
                .parish("St Mary")
                .build();

        when(sacramentAuthorizationService.requireBaptismForCommunionCreate(1L)).thenReturn(1L);
        when(communionService.create(any(FirstHolyCommunionRequest.class))).thenReturn(response);

        mvc.perform(post("/api/communions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.baptismId").value(1));
    }

    @Test
    void getByParish_returnsEmptyPage_whenNone() throws Exception {
        when(communionService.findByParishId(eq(1L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        mvc.perform(get("/api/parishes/1/communions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void getById_returns404_whenNotExists() throws Exception {
        when(communionService.findById(999L)).thenReturn(java.util.Optional.empty());

        mvc.perform(get("/api/communions/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createMultipart_externalBaptism_returns201_whenCertificateMissing() throws Exception {
        doNothing().when(sacramentAuthorizationService).requireWriteAccessForParish(1L);

        when(baptismService.create(eq(1L), any(BaptismRequest.class)))
                .thenReturn(BaptismResponse.builder().id(42L).build());

        FirstHolyCommunionResponse communionResponse = FirstHolyCommunionResponse.builder()
                .id(99L)
                .baptismId(42L)
                .communionDate(LocalDate.of(2025, 6, 1))
                .officiatingPriest("Fr. Smith")
                .parish("St Mary")
                .build();
        when(communionService.create(any(FirstHolyCommunionRequest.class))).thenReturn(communionResponse);

        mvc.perform(multipart("/api/communions")
                        .param("baptismSource", "external")
                        .param("parishId", "1")
                        .param("communionDate", "2025-06-01")
                        .param("officiatingPriest", "Fr. Smith")
                        .param("parish", "St Mary")
                        .param("externalBaptismName", "John")
                        .param("externalSurname", "Doe"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(99))
                .andExpect(jsonPath("$.baptismId").value(42));

        verify(remoteFileService, never()).upload(anyString(), anyString(), any(), anyString());

        ArgumentCaptor<BaptismRequest> baptismCaptor = ArgumentCaptor.forClass(BaptismRequest.class);
        verify(baptismService).create(eq(1L), baptismCaptor.capture());
        assertNull(baptismCaptor.getValue().getExternalCertificatePath());

        ArgumentCaptor<FirstHolyCommunionRequest> communionCaptor = ArgumentCaptor.forClass(FirstHolyCommunionRequest.class);
        verify(communionService).create(communionCaptor.capture());
        assertNull(communionCaptor.getValue().getBaptismCertificatePath());
    }
}
