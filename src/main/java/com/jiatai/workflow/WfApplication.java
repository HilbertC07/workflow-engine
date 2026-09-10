package com.jiatai.workflow;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.jiatai.workflow.mapper")
public class WfApplication {
    public static void main(String[] args) {
        SpringApplication.run(WfApplication.class, args);
    }
}
