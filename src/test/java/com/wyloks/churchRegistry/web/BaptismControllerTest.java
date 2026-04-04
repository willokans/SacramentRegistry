package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.wyloks.churchRegistry.dto.BaptismRequest;
import com.wyloks.churchRegistry.dto.BaptismResponse;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.BaptismService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = BaptismController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class BaptismControllerTest {

    @Autowired
    MockMvc mvc;

    ObjectMapper objectMapper;

    @MockBean
    BaptismService baptismService;

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
    void getBaptismsByParish_returnsEmptyPage_whenNoneExist() throws Exception {
        when(baptismService.findByParishId(eq(1L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        mvc.perform(get("/api/parishes/1/baptisms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void searchBaptisms_returnsMatchingResults() throws Exception {
        BaptismResponse response = BaptismResponse.builder()
                .id(1L)
                .baptismName("Alice")
                .surname("Smith")
                .parishId(1L)
                .build();
        when(baptismService.searchByNameOrAddress(eq(1L), eq("alice"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(response), PageRequest.of(0, 50), 1));

        mvc.perform(get("/api/parishes/1/baptisms/search").param("q", "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].baptismName").value("Alice"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void searchBaptisms_returnsEmptyPage_whenQueryBlank() throws Exception {
        mvc.perform(get("/api/parishes/1/baptisms/search").param("q", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void createBaptism_returns201AndBody_whenValid() throws Exception {
        BaptismRequest request = BaptismRequest.builder()
                .baptismName("John")
                .surname("Doe")
                .gender("M")
                .dateOfBirth(LocalDate.of(2020, 1, 15))
                .fathersName("James Doe")
                .mothersName("Mary Doe")
                .sponsorNames("Peter, Paul")
                .parishId(1L)
                .placeOfBirth("Lagos General Hospital")
                .placeOfBaptism("St Mary Church")
                .dateOfBaptism(LocalDate.of(2020, 2, 20))
                .build();
        BaptismResponse response = BaptismResponse.builder()
                .id(1L)
                .baptismName("John")
                .surname("Doe")
                .gender("M")
                .dateOfBirth(LocalDate.of(2020, 1, 15))
                .fathersName("James Doe")
                .mothersName("Mary Doe")
                .sponsorNames("Peter, Paul")
                .parishId(1L)
                .build();

        when(baptismService.create(eq(1L), any(BaptismRequest.class))).thenReturn(response);

        mvc.perform(post("/api/parishes/1/baptisms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.baptismName").value("John"))
                .andExpect(jsonPath("$.surname").value("Doe"));
    }

    @Test
    void getBaptismById_returns200_whenExists() throws Exception {
        when(sacramentAuthorizationService.requireReadAccessForBaptism(1L)).thenReturn(true);
        BaptismResponse response = BaptismResponse.builder().id(1L).baptismName("John").surname("Doe").build();
        when(baptismService.findById(1L)).thenReturn(java.util.Optional.of(response));

        mvc.perform(get("/api/baptisms/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.baptismName").value("John"));

        verify(sacramentAuthorizationService).requireReadAccessForBaptism(1L);
    }

    @Test
    void getBaptismById_returns404_whenNotExists() throws Exception {
        when(sacramentAuthorizationService.requireReadAccessForBaptism(999L)).thenReturn(false);

        mvc.perform(get("/api/baptisms/999"))
                .andExpect(status().isNotFound());

        verify(baptismService, never()).findById(anyLong());
    }
}
